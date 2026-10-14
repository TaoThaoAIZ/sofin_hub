import { createHash } from 'node:crypto';
import { prisma } from '../../db/prisma.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { ChatbotQaSource, ChatbotQaStatus } from '../../generated/prisma/client.js';
import { trgmSchema } from '../search/search.repository.js';
import { normalizeText } from '../search/search.text.js';

/**
 * Kho tri thức của chatbot: câu hỏi mẫu (ChatbotQA) + tài liệu markdown cắt theo mục `##` (ChatbotDocument/ChatbotDocChunk).
 * Khớp câu hỏi = độ giống trigram (pg_trgm.similarity) trên câu đã gập dấu (sf_fold) với question và từng variant, cộng ts_rank
 * toàn văn để xếp hạng phụ. Bảng nhỏ (vài nghìn hàng) nên chấm điểm trên mọi hàng active là đủ nhanh.
 */

export interface QaMatch {
  id: string;
  question: string;
  answer: string;
  /** Độ giống trigram cao nhất giữa câu hỏi khách và question/variants (0..1). */
  similarity: number;
  /** ts_rank toàn văn (bổ trợ xếp hạng). */
  rank: number;
}

export interface ChunkMatch {
  id: string;
  documentId: string;
  documentTitle: string;
  heading: string;
  content: string;
  rank: number;
}

const ident = (s: string) => Prisma.raw(`"${s.replaceAll('"', '""')}"`);

/** Chuỗi so khớp đã gập dấu (giống sf_fold phía SQL) + tsquery dạng OR (khớp bất kỳ từ nào, ưu tiên recall). */
export function queryTerms(text: string): { needle: string; tsq: string | null } {
  const needle = normalizeText(text).replace(/\s+/g, ' ').trim().slice(0, 500);
  const tokens = [...new Set(needle.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 2))].slice(0, 16);
  return { needle, tsq: tokens.length ? tokens.map((t) => `${t}:*`).join(' | ') : null };
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

/** Cắt markdown thành các đoạn theo `## `. Phần trước mục `##` đầu tiên (nếu có nội dung) thành đoạn mang tên tài liệu. */
export function splitMarkdown(md: string): { title: string | null; chunks: { heading: string; content: string }[] } {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let title: string | null = null;
  const chunks: { heading: string; content: string }[] = [];
  let heading: string | null = null;
  let buf: string[] = [];
  const flush = () => {
    const content = buf.join('\n').trim();
    if (content) chunks.push({ heading: heading ?? title ?? 'Giới thiệu', content });
    buf = [];
  };
  for (const line of lines) {
    const h1 = /^#\s+(.+)$/.exec(line);
    const h2 = /^##\s+(.+)$/.exec(line);
    if (h1 && title === null && chunks.length === 0 && buf.every((l) => !l.trim())) {
      title = h1[1]!.trim();
      continue;
    }
    if (h2) {
      flush();
      heading = h2[1]!.trim();
      continue;
    }
    buf.push(line);
  }
  flush();
  return { title, chunks };
}

export const chatbotRepository = {
  // ------------------------------------------------------------------ khớp / tìm
  /**
   * Q&A active khớp nhất với `text`. order='similarity' (khớp trực tiếp: chỉ độ giống câu hỏi) | 'blend' (tool tra cứu: giống + ts_rank).
   * Không có pg_trgm => similarity=0, chỉ còn ts_rank (vẫn tra cứu được, không bao giờ "khớp trực tiếp").
   */
  async matchQa(text: string, opts: { limit?: number; order?: 'similarity' | 'blend'; statuses?: ChatbotQaStatus[] } = {}): Promise<QaMatch[]> {
    const { needle, tsq } = queryTerms(text);
    if (!needle) return [];
    const S = await trgmSchema();
    const statuses = opts.statuses ?? ['active'];
    const simOf = (expr: Prisma.Sql) => (S ? Prisma.sql`${ident(S)}.similarity(${expr}, ${needle})` : Prisma.sql`0::real`);
    const sim = Prisma.sql`GREATEST(${simOf(Prisma.sql`sf_fold(q."question")`)}, COALESCE((SELECT max(${simOf(Prisma.sql`sf_fold(v)`)}) FROM unnest(q."variants") v), 0))`;
    const rank = tsq ? Prisma.sql`ts_rank(q."searchVector", to_tsquery('simple', ${tsq}))` : Prisma.sql`0::real`;
    const order = opts.order === 'blend' ? Prisma.sql`("similarity" + "rank") DESC` : Prisma.sql`"similarity" DESC, "rank" DESC`;
    const rows = await prisma.$queryRaw<QaMatch[]>`
      SELECT * FROM (
        SELECT q."id", q."question", q."answer", (${sim})::float8 AS "similarity", (${rank})::float8 AS "rank"
        FROM "ChatbotQA" q
        WHERE q."status"::text IN (${Prisma.join(statuses)})
      ) x
      WHERE x."similarity" > 0 OR x."rank" > 0
      ORDER BY ${order}, x."id"
      LIMIT ${opts.limit ?? 5}`;
    return rows;
  },

  async recordHit(id: string): Promise<void> {
    await prisma.chatbotQA.update({ where: { id }, data: { hitCount: { increment: 1 }, lastHitAt: new Date() } }).catch(() => undefined);
  },

  /** Đoạn tài liệu (tài liệu active) khớp `text` theo toàn văn. */
  async searchChunks(text: string, limit = 4): Promise<ChunkMatch[]> {
    const { tsq } = queryTerms(text);
    if (!tsq) return [];
    return prisma.$queryRaw<ChunkMatch[]>`
      SELECT c."id", c."documentId", d."title" AS "documentTitle", c."heading", c."content",
             ts_rank(c."searchVector", to_tsquery('simple', ${tsq}))::float8 AS "rank"
      FROM "ChatbotDocChunk" c JOIN "ChatbotDocument" d ON d."id" = c."documentId"
      WHERE d."status" = 'active' AND c."searchVector" @@ to_tsquery('simple', ${tsq})
      ORDER BY "rank" DESC, c."position"
      LIMIT ${limit}`;
  },

  // ------------------------------------------------------------------ Q&A (admin)
  async listQa(f: { status?: ChatbotQaStatus; source?: ChatbotQaSource; q?: string; skip: number; take: number }) {
    const where: Prisma.ChatbotQAWhereInput = {
      ...(f.status ? { status: f.status } : {}),
      ...(f.source ? { source: f.source } : {}),
      ...(f.q
        ? {
            OR: [
              { question: { contains: f.q, mode: 'insensitive' } },
              { answer: { contains: f.q, mode: 'insensitive' } },
              { variants: { has: f.q } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.chatbotQA.findMany({ where, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }], skip: f.skip, take: f.take }),
      prisma.chatbotQA.count({ where }),
    ]);
    return { rows, total };
  },

  getQa: (id: string) => prisma.chatbotQA.findUnique({ where: { id } }),

  createQa: (data: Prisma.ChatbotQAUncheckedCreateInput) => prisma.chatbotQA.create({ data }),

  updateQa: (id: string, data: Prisma.ChatbotQAUncheckedUpdateInput) => prisma.chatbotQA.update({ where: { id }, data }),

  countQaByStatus: () => prisma.chatbotQA.groupBy({ by: ['status'], _count: { _all: true } }),

  /** Thêm một cách hỏi mới vào Q&A (bỏ qua nếu trùng sau khi gập dấu). Trả về true nếu có thêm. */
  async addVariant(id: string, variant: string): Promise<boolean> {
    const qa = await prisma.chatbotQA.findUnique({ where: { id }, select: { question: true, variants: true } });
    if (!qa) return false;
    const key = normalizeText(variant).trim();
    if ([qa.question, ...qa.variants].some((v) => normalizeText(v).trim() === key) || qa.variants.length >= 30) return false;
    await prisma.chatbotQA.update({ where: { id }, data: { variants: { push: variant.trim() } } });
    return true;
  },

  // ------------------------------------------------------------------ tài liệu
  listDocuments: () =>
    prisma.chatbotDocument.findMany({
      orderBy: [{ status: 'asc' }, { title: 'asc' }],
      select: { id: true, slug: true, title: true, status: true, updatedAt: true, _count: { select: { chunks: true } } },
    }),

  getDocument: (id: string) =>
    prisma.chatbotDocument.findUnique({ where: { id }, include: { chunks: { orderBy: { position: 'asc' }, select: { id: true, position: true, heading: true, content: true } } } }),

  /**
   * Tạo/cập nhật tài liệu theo slug. Cùng nội dung (contentHash) => không làm gì. Nội dung đổi => cắt lại các đoạn và chuyển các Q&A active
   * dựa vào tài liệu này sang `stale`. Trả về trạng thái để script/admin báo lại.
   */
  async upsertDocument(input: { slug: string; title?: string; contentMd: string; updatedById?: string | null }) {
    const contentMd = input.contentMd.replace(/\r\n/g, '\n').trim();
    const { title: mdTitle, chunks } = splitMarkdown(contentMd);
    const title = (input.title ?? mdTitle ?? input.slug).trim();
    const contentHash = sha256(contentMd);
    const existing = await prisma.chatbotDocument.findUnique({ where: { slug: input.slug } });
    if (existing && existing.contentHash === contentHash && existing.title === title) {
      return { document: existing, result: 'unchanged' as const, chunks: chunks.length, staleQa: 0 };
    }
    return prisma.$transaction(async (tx) => {
      const document = existing
        ? await tx.chatbotDocument.update({ where: { id: existing.id }, data: { title, contentMd, contentHash, status: 'active', updatedById: input.updatedById ?? null } })
        : await tx.chatbotDocument.create({ data: { slug: input.slug, title, contentMd, contentHash, updatedById: input.updatedById ?? null } });
      await tx.chatbotDocChunk.deleteMany({ where: { documentId: document.id } });
      await tx.chatbotDocChunk.createMany({ data: chunks.map((c, i) => ({ documentId: document.id, position: i + 1, heading: c.heading, content: c.content })) });
      const stale =
        existing && existing.contentHash !== contentHash
          ? await tx.chatbotQA.updateMany({ where: { documentId: document.id, status: 'active' }, data: { status: 'stale' } })
          : { count: 0 };
      return { document, result: existing ? ('updated' as const) : ('created' as const), chunks: chunks.length, staleQa: stale.count };
    });
  },

  setDocumentStatus: (id: string, status: 'active' | 'archived') => prisma.chatbotDocument.update({ where: { id }, data: { status } }),
};
