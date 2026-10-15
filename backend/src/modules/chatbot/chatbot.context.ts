import { prisma } from '../../db/prisma.js';
import { sendTelegram } from '../payments/payments.alerts.js';
import { searchService } from '../search/search.service.js';
import { normalizeText } from '../search/search.text.js';
import { cfg } from '../settings/settings.service.js';
import { addMessage, createTicket, OPEN_STATUSES, ticketCode } from '../support/tickets.core.js';
import { TOOLS } from '../tools/tools.catalog.js';
import { accountGroups, myAccount } from './chatbot.my-data.js';
import { chatbotSettings } from './chatbot.config.js';
import { conversationRepository } from './chatbot.conversations.js';
import { chatbotRepository } from './chatbot.repository.js';

/**
 * Ngữ cảnh cho 1 câu hỏi: server tự gom dữ liệu (thay cho việc để AI gọi tool) rồi đưa vào prompt. Danh tính người hỏi lấy từ
 * phiên đăng nhập — dữ liệu thanh toán chỉ của CHÍNH người đó. Mọi con số bot được nói phải nằm trong ngữ cảnh này
 * (guardrail đầu ra so khớp với `sourcesOf`).
 */
export interface ChatContext {
  userId: string;
  conversationId: string;
  viewer: { firstName: string; lastName: string; email: string };
  /** Cộng đồng khách đang xem (widget gửi theo URL /communities/:id...) — để hiểu "người này", "cộng đồng này". */
  pageCommunityId?: string;
}

export interface HandoffResult {
  ticketId: string;
  ticketCode: string;
  zaloUrl: string | null;
  message: string;
}

export interface KnowledgeContext {
  sampleAnswers: { id: string; question: string; answer: string }[];
  documents: { document: string; section: string; content: string }[];
  tools: ReturnType<typeof toolView>[];
  communities: { title: string; summary: string; link: string; price?: string }[];
  /** Chủ đề khóa học đang có (chỉ khi khách hỏi chung về khóa học mà chưa nói chủ đề) — để bot hỏi lại + gợi ý. */
  categories: { name: string; courses: number }[];
  /** null = không đưa vào ngữ cảnh (câu hỏi không liên quan đơn/thanh toán) — giảm dữ liệu cá nhân gửi sang ChatGPT. */
  /** Thông tin CÔNG KHAI của cộng đồng khách đang xem (null = không ở trang cộng đồng / không xem được). */
  currentPage: { community: { name: string; link: string; description: string; instructor: string; promise: string | null; benefits: string[]; rules: string[]; price: string; members: number } } | null;
  myPayments: { community: string; amount: string; status: string; type: string; createdAt: string; transferContent?: string; refunded?: string }[] | null;
  /** Cộng đồng CHÍNH khách đã tham gia (null = câu hỏi không hỏi về cộng đồng/khóa học của khách). */
  myCommunities: { name: string; link: string; role: string; joinedAt: string }[] | null;
  /** Tài khoản của CHÍNH khách (hồ sơ / gói & học tập / sự kiện & thông báo / giới thiệu & ticket) — chỉ nhóm câu hỏi nhắc tới; null = không kèm. */
  myAccount: Awaited<ReturnType<typeof myAccount>>;
  platformFacts: Record<string, unknown>;
  /** ID nguồn đã đưa vào ngữ cảnh — KHÔNG đưa vào prompt; ghi vào ChatbotMessage.toolCalls để kiểm tra (chỉ câu mẫu active, tài liệu active). */
  sources: { qaIds: string[]; chunks: { id: string; documentId: string }[] };
}

const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;

export const toolView = (t: (typeof TOOLS)[number]) => ({
  id: t.id,
  name: t.name,
  category: t.category,
  description: t.desc,
  free: t.free,
  ...(t.free && t.downloadUrl ? { downloadUrl: t.downloadUrl } : { howToBuy: 'Bấm "Mua ngay" ở trang /tools để lại thông tin, người hỗ trợ liên hệ báo giá và hướng dẫn thanh toán.' }),
});

const PAYMENT_STATUS: Record<string, string> = {
  pending: 'đang chờ chuyển khoản',
  succeeded: 'đã thanh toán thành công',
  failed: 'thất bại/hết hạn',
  refunded: 'đã hoàn tiền',
};

async function myPayments(userId: string): Promise<KnowledgeContext['myPayments']> {
  const rows = await prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { amountCents: true, status: true, kind: true, refCode: true, createdAt: true, refundedCents: true, community: { select: { title: true } } },
  });
  return rows.map((p) => ({
    community: p.community.title,
    amount: vnd(p.amountCents),
    status: PAYMENT_STATUS[p.status] ?? p.status,
    type: p.kind === 'module' ? 'mua lẻ module' : p.kind === 'renewal' ? 'gia hạn' : 'tham gia',
    createdAt: p.createdAt.toISOString().slice(0, 10),
    ...(p.status === 'pending' && p.refCode ? { transferContent: p.refCode } : {}),
    ...(p.refundedCents > 0 ? { refunded: vnd(p.refundedCents) } : {}),
  }));
}

const ROLE_LABEL: Record<string, string> = { owner: 'chủ cộng đồng', admin: 'quản trị viên', mod: 'điều hành viên', member: 'thành viên' };

/** Cộng đồng khách đang tham gia (mới tham gia trước), bỏ cộng đồng đã xóa / bị gỡ. */
async function myCommunities(userId: string): Promise<NonNullable<KnowledgeContext['myCommunities']>> {
  const rows = await prisma.enrollment.findMany({
    where: { userId, community: { deletedAt: null, moderationStatus: 'active' } },
    orderBy: { enrolledAt: 'desc' },
    take: 20,
    select: { role: true, enrolledAt: true, community: { select: { id: true, title: true } } },
  });
  return rows.map((e) => ({
    name: e.community.title,
    link: `/communities/${e.community.id}`,
    role: ROLE_LABEL[e.role] ?? e.role,
    joinedAt: e.enrolledAt.toISOString().slice(0, 10),
  }));
}

function platformFacts(): Record<string, unknown> {
  const c = cfg();
  return {
    currency: c.payments.currency,
    refundWindowDays: c.payments.refundWindowDays,
    monthlyPeriodDays: c.payments.subscriptionPeriodDays,
    annualPeriodDays: c.payments.annualPeriodDays,
    renewalReminderDaysBefore: c.payments.trialReminderDays,
    platformCommissionPercentForOwners: c.payments.commissionPct,
    ownerPlans: {
      start: { price: vnd(0), transactionFeePercent: c.owner.startFeePct },
      pro: { monthly: vnd(c.owner.proMonthlyPrice), annual: vnd(c.owner.proAnnualPrice), transactionFeePercent: c.owner.proFeePct, trialDays: c.owner.trialDays },
    },
    referral: { creatorPercent: c.referral.creatorRateBps / 100, memberPercent: c.referral.memberRateBps / 100, attributionDays: c.referral.attributionDays },
    paymentMethod: 'Chuyển khoản bằng mã VietQR do hệ thống tạo ở trang thanh toán; tiền về hệ thống tự xác nhận. Không tự động trừ tiền.',
    myPaymentsPage: '/settings/thanh-toan',
    toolsPage: '/tools',
  };
}

/** Câu hỏi (hoặc lượt khách ngay trước) nhắc tới đơn/thanh toán => mới đưa giao dịch của khách vào ngữ cảnh. */
const PAYMENT_TOPIC = /\b(don|thanh toan|chuyen khoan|hoan tien|giao dich|gia han|hoa don|bill|kich hoat|nap|tru tien|da tra|chua nhan|qr|vietqr|ma noi dung|goi thanh vien|huy goi|order|payment|refund|invoice)\b|sfh[a-z0-9]{4,}/;
export const isPaymentTopic = (texts: string[]) => texts.some((t) => PAYMENT_TOPIC.test(normalizeText(t)));

/** Khách hỏi về cộng đồng/khóa học CỦA MÌNH ("tôi đã tham gia cộng đồng nào", "khóa học của tôi") => đưa danh sách đã tham gia. */
const MY_COMMUNITIES_TOPIC =
  /\b(da|dang) (tham gia|dang ky)\b|\b(da|dang) (hoc|mua|vao|o) (nhung |cac )?(cong dong|khoa|lop|nhom)\b|\b(cong dong|khoa hoc|lop hoc|nhom|course|community)( nao)? (cua )?(toi|minh|em|tui)\b|\b(toi|minh|em|tui) (o|trong|thuoc) (nhung |cac )?(cong dong|khoa hoc|nhom)\b|\bmy (communities|courses)\b/;
export const isMyCommunitiesTopic = (text: string) => MY_COMMUNITIES_TOPIC.test(normalizeText(text));
/** Câu hỏi về dữ liệu của CHÍNH khách => không trả câu mẫu (câu mẫu là câu chung, dễ khớp nhầm "cách làm"). */
export const isPersonalTopic = (text: string) => isMyCommunitiesTopic(text) || accountGroups(text).length > 0;

/** Câu hỏi chung về khóa học/cộng đồng => đưa thêm cộng đồng nổi bật (tìm theo nguyên câu thường không khớp gì). */
const CATALOG_TOPIC = /\b(khoa hoc|cong dong|lop hoc|hoc phi|dang ky hoc|course|community|courses)\b/;

const LISTED = { deletedAt: null, locked: false, moderationStatus: 'active', discoveryStatus: 'listed', visibility: 'public' } as const;

/** Chủ đề (DiscoveryCategory đang bật) có ít nhất 1 khóa học hiển thị, nhiều khóa học trước. */
async function courseCategories(): Promise<(KnowledgeContext['categories'][number] & { key: string })[]> {
  const [cats, counts] = await Promise.all([
    prisma.discoveryCategory.findMany({ where: { status: 'active' }, orderBy: [{ position: 'asc' }, { key: 'asc' }], select: { key: true, name: true } }),
    prisma.community.groupBy({ by: ['category'], where: LISTED, _count: true }),
  ]);
  const n = new Map(counts.map((c) => [c.category as string, c._count]));
  return cats
    .map((c) => ({ key: c.key as string, name: c.name, courses: n.get(c.key) ?? 0 }))
    .filter((c) => c.courses > 0)
    .sort((a, b) => b.courses - a.courses);
}

/** Tên chủ đề khách nhắc tới (vd bấm gợi ý "Công nghệ") — so khớp không dấu với tên danh mục. */
function categoryIn(texts: string[], cats: { key: string; name: string }[]) {
  const t = ` ${texts.map(normalizeText).join(' ')} `;
  return cats.find((c) => t.includes(` ${normalizeText(c.name)} `));
}

async function featuredCommunities(limit: number, category?: string): Promise<KnowledgeContext['communities']> {
  const rows = await prisma.community.findMany({
    where: { ...LISTED, ...(category ? { category: category as never } : {}) },
    orderBy: [{ students: 'desc' }, { rating: 'desc' }, { id: 'asc' }],
    take: limit,
    select: { id: true, title: true, description: true, pricing: true, priceCents: true, priceAnnualCents: true },
  });
  return rows.map((c) => ({
    title: c.title,
    summary: c.description.slice(0, 200),
    link: `/communities/${c.id}`,
    price:
      c.pricing === 'free' || c.priceCents === 0
        ? 'Miễn phí'
        : `${vnd(c.priceCents)}/tháng${c.priceAnnualCents ? ` hoặc ${vnd(c.priceAnnualCents)}/năm` : ''}`,
  }));
}

/**
 * Thông tin CÔNG KHAI (như trang giới thiệu) của cộng đồng khách đang xem: tên, mô tả, người hướng dẫn, lợi ích, nội quy, giá, số thành
 * viên. Không có bài học / bài đăng / danh sách thành viên. Cộng đồng riêng tư chỉ khi khách là thành viên; nháp / bị gỡ / bị khóa => null.
 */
async function pageCommunity(userId: string, communityId: string): Promise<KnowledgeContext['currentPage']> {
  const c = await prisma.community.findFirst({
    where: { id: communityId, deletedAt: null, locked: false, moderationStatus: 'active' },
    select: { id: true, title: true, description: true, instructorName: true, instructorRole: true, promise: true, benefits: true, rules: true, visibility: true, pricing: true, priceCents: true, priceAnnualCents: true, _count: { select: { enrollments: true } } },
  });
  if (!c) return null;
  if (c.visibility !== 'public' && !(await prisma.enrollment.findUnique({ where: { userId_communityId: { userId, communityId } }, select: { userId: true } }))) return null;
  const rules = Array.isArray(c.rules) ? (c.rules as { title?: unknown }[]).map((r) => String(r.title ?? '')).filter(Boolean).slice(0, 10) : [];
  return {
    community: {
      name: c.title,
      link: `/communities/${c.id}`,
      description: c.description.slice(0, 800),
      instructor: [c.instructorName, c.instructorRole].filter(Boolean).join(' — '),
      promise: c.promise,
      benefits: c.benefits.slice(0, 8),
      rules,
      price: c.pricing === 'free' || c.priceCents === 0 ? 'Miễn phí' : `${vnd(c.priceCents)}/tháng${c.priceAnnualCents ? ` hoặc ${vnd(c.priceAnnualCents)}/năm` : ''}`,
      members: c._count.enrollments,
    },
  };
}

/**
 * Gom ngữ cảnh cho câu hỏi `text` (truy vấn song song, mỗi phần có giới hạn kích thước). `recentUserTexts` = các tin khách gần
 * nhất (để câu nối tiếp như "còn đơn kia thì sao" vẫn nhận ra chủ đề thanh toán).
 */
export async function gatherContext(ctx: ChatContext, text: string, recentUserTexts: string[] = []): Promise<KnowledgeContext> {
  const wantPayments = isPaymentTopic([text, ...recentUserTexts.slice(-1)]);
  const wantCatalog = CATALOG_TOPIC.test(normalizeText(text));
  const wantMine = isMyCommunitiesTopic(text);
  // Nhóm dữ liệu tài khoản: theo câu hiện tại + câu khách ngay trước (câu nối tiếp "còn cái kia thì sao").
  const groups = [...new Set([text, ...recentUserTexts.slice(-1)].flatMap(accountGroups))];
  const [qa, chunks, found, payments, cats, mine, account] = await Promise.all([
    chatbotRepository.matchQa(text, { limit: 5, order: 'blend' }),
    chatbotRepository.searchChunks(text, 4),
    searchService
      .search(ctx.userId, { q: text.slice(0, 100), type: 'courses', page: 1, limit: 3 })
      .then((r) =>
        r.data.map((d) => {
          const x = d as { title?: string; snippet?: string; link?: string };
          return { title: x.title ?? '', summary: (x.snippet ?? '').slice(0, 200), link: x.link ?? '' };
        }),
      )
      .catch(() => []),
    wantPayments ? myPayments(ctx.userId) : Promise.resolve(null),
    courseCategories().catch(() => []),
    wantMine ? myCommunities(ctx.userId).catch(() => []) : Promise.resolve(null),
    myAccount(ctx.userId, groups),
  ]);
  const currentPage = ctx.pageCommunityId ? await pageCommunity(ctx.userId, ctx.pageCommunityId).catch(() => null) : null;
  // Khách nhắc tên một chủ đề (thường do bấm gợi ý) => khóa học của chủ đề đó (có giá).
  // Hỏi chung về khóa học mà không khớp gì => KHÔNG liệt kê khóa học; đưa danh sách chủ đề để bot hỏi lại khách quan tâm chủ đề nào.
  const topic = found.length ? undefined : categoryIn([text], cats);
  const communities = topic ? await featuredCommunities(5, topic.key) : found;
  const categories = !mine && !topic && !found.length && wantCatalog ? cats.map(({ name, courses }) => ({ name, courses })) : [];
  return {
    sampleAnswers: qa.map((q) => ({ id: q.id, question: q.question, answer: q.answer })),
    documents: chunks.map((c) => ({ document: c.documentTitle, section: c.heading, content: c.content })),
    sources: { qaIds: qa.map((q) => q.id), chunks: chunks.map((c) => ({ id: c.id, documentId: c.documentId })) },
    tools: TOOLS.map(toolView),
    communities,
    categories,
    currentPage,
    myPayments: payments,
    myCommunities: mine,
    myAccount: account,
    platformFacts: platformFacts(),
  };
}

/** Văn bản nguồn cho guardrail đầu ra (con số trong câu trả lời phải xuất hiện ở đây hoặc trong tin của khách). */
export const sourcesOf = (k: KnowledgeContext, userText: string): string[] => [userText, JSON.stringify({ ...k, sources: undefined })];

/** Số ticket chatbot MỚI tối đa mỗi khách / 24h (chống spam ticket qua chatbot). */
export const MAX_NEW_HANDOFF_TICKETS_PER_DAY = 3;

/**
 * Chuyển người hỗ trợ: tạo ticket nội bộ (kèm đoạn chat) + báo Telegram + chuyển hội thoại sang handed_off. Chống spam:
 *  - hội thoại đã chuyển => trả lại mã cũ;
 *  - khách đã có ticket chatbot CÒN MỞ trong 24h => dùng lại ticket đó (ghi thêm đoạn chat mới làm ghi chú nội bộ), không tạo mới;
 *  - đã tạo đủ MAX_NEW_HANDOFF_TICKETS_PER_DAY ticket trong 24h => dùng lại ticket gần nhất.
 */
export async function handoffToZalo(ctx: ChatContext, input: { reason: string; category: 'user' | 'creator' | 'payment' }): Promise<HandoffResult> {
  const settings = chatbotSettings();
  const zaloUrl = settings.zaloSupportUrl || null;
  const conv = await conversationRepository.findById(ctx.conversationId);
  const messageFor = (code: string) => settings.zaloHandoffText.replaceAll('{code}', code);
  if (conv?.ticketId && conv.ticketCode) {
    return { ticketId: conv.ticketId, ticketCode: conv.ticketCode, zaloUrl, message: messageFor(conv.ticketCode) };
  }
  const name = `${ctx.viewer.firstName} ${ctx.viewer.lastName}`.trim() || ctx.viewer.email;
  const reason = input.reason.trim().slice(0, 500) || 'Khách cần người hỗ trợ';
  const transcript = (await conversationRepository.allMessages(ctx.conversationId))
    .map((m) => `${m.role === 'user' ? 'Khách' : 'Bot'}: ${m.content}`)
    .join('\n')
    .slice(-12_000);
  const note = `Đoạn chat với bot (lý do: ${reason}):\n\n${transcript || '(trống)'}`;

  const since = new Date(Date.now() - 24 * 3600_000);
  const recent = await prisma.supportTicket.findMany({
    where: { requesterId: ctx.userId, source: 'chatbot', createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, number: true, status: true },
  });
  const reuse = recent.find((t) => OPEN_STATUSES.includes(t.status)) ?? (recent.length >= MAX_NEW_HANDOFF_TICKETS_PER_DAY ? recent[0] : undefined);

  let ticketId: string;
  let number: number;
  if (reuse) {
    await addMessage(reuse.id, { kind: 'internal_note', authorId: null, authorName: 'Chatbot', body: note });
    ticketId = reuse.id;
    number = reuse.number;
  } else {
    const ticket = await createTicket({
      subject: `Chatbot: ${reason.slice(0, 120)}`,
      message: reason,
      category: input.category,
      requesterId: ctx.userId,
      requesterName: name,
      requesterEmail: ctx.viewer.email,
      source: 'chatbot',
    });
    await addMessage(ticket.id, { kind: 'internal_note', authorId: null, authorName: 'Chatbot', body: note });
    ticketId = ticket.id;
    number = ticket.number;
  }
  const code = ticketCode(number);
  await conversationRepository.setStatus(ctx.conversationId, { status: 'handed_off', ticketId, ticketCode: code });
  if (!reuse) {
    const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    void sendTelegram(`💬 <b>CHATBOT CHUYỂN NGƯỜI HỖ TRỢ</b>\n\n🎫 <b>Mã:</b> ${code}\n👤 <b>Khách:</b> ${esc(name)} (${esc(ctx.viewer.email)})\n📝 <b>Lý do:</b> ${esc(reason)}`).catch((e) =>
      console.error('[chatbot] gửi Telegram lỗi:', e),
    );
  }
  return { ticketId, ticketCode: code, zaloUrl, message: messageFor(code) };
}
