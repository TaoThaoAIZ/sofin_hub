import { prisma } from '../../db/prisma.js';
import { postCategoryFromDomain, postCategoryToDomain } from '../../db/enums.js';
import { Prisma } from '../../generated/prisma/client.js';
import type { PostComment as DbComment, Post as DbPost } from '../../generated/prisma/client.js';
import type { Comment, PollDef, Post, PostCategory } from './posts.types.js';

/** Bảng tin (Postgres qua Prisma: Post, PostComment, PostLike, PostLikeNotice, PollVote). */
export interface ListPostsParams {
  courseId: string;
  category?: PostCategory;
  /** Thẻ đã chuẩn hóa (bỏ '#', chữ thường) — so khớp với từng phần tử của Post.tags cũng đã chuẩn hóa. */
  tag?: string;
  sort: 'latest' | 'popular';
  page: number;
  limit: number;
  /** false = chỉ thấy bài không ẩn + bài của chính viewerId; true = thấy tất cả (mod trở lên). */
  seeHidden: boolean;
  viewerId?: string;
}

export interface PostsRepository {
  /** Ghim lên đầu, sort latest/popular, lọc, ẩn bài hidden và phân trang — tất cả bằng truy vấn DB. */
  list(params: ListPostsParams): Promise<{ items: Post[]; total: number }>;
  /** Top thẻ (không tính bài ẩn), gộp theo thẻ chuẩn hóa; `tag` là dạng hiển thị của thẻ được gặp mới nhất. */
  popularTags(courseId: string, limit: number): Promise<{ tag: string; count: number }[]>;
  findById(postId: string): Promise<Post | undefined>;
  create(courseId: string, authorId: string, content: string, category: PostCategory, tags: string[], imageUrl?: string, poll?: PollDef): Promise<Post>;
  update(postId: string, patch: { content?: string; category?: PostCategory; tags?: string[] }): Promise<Post | undefined>;
  /** Xóa bài; bình luận, like, phiếu bình chọn xóa theo (CASCADE). */
  delete(postId: string): Promise<void>;
  setPinned(postId: string, pinned: boolean): Promise<void>;
  setHidden(postId: string, hidden: boolean): Promise<void>;
  isLiked(postId: string, userId: string): Promise<boolean>;
  /** Trong số các bài đã cho, những bài userId đang thích. */
  likedPostIds(postIds: string[], userId: string): Promise<Set<string>>;
  /** Thích/bỏ thích và cập nhật likesCount trong CÙNG transaction. Trả trạng thái mới (false nếu bài không còn). */
  toggleLike(postId: string, userId: string): Promise<boolean>;
  /** true nếu đây là lần đầu cặp (bài, user) được đánh dấu — dùng để chỉ thông báo/cộng điểm like 1 lần. */
  markLikeNotified(postId: string, userId: string): Promise<boolean>;
  listComments(postId: string): Promise<Comment[]>;
  findComment(commentId: string): Promise<Comment | undefined>;
  addComment(postId: string, authorId: string, content: string): Promise<Comment>;
  updateComment(commentId: string, content: string): Promise<Comment | undefined>;
  deleteComment(commentId: string): Promise<void>;
  setCommentHidden(commentId: string, hidden: boolean): Promise<void>;
  /** Ghi đè lựa chọn của user (rỗng = bỏ phiếu). */
  setVote(postId: string, userId: string, optionIds: string[]): Promise<void>;
  /** userId -> các optionId đã chọn. */
  getVotes(postId: string): Promise<Map<string, string[]>>;
  getVotesMany(postIds: string[]): Promise<Map<string, Map<string, string[]>>>;
}

const toPost = (p: DbPost): Post => ({
  id: p.id,
  courseId: p.courseId,
  authorId: p.authorId,
  content: p.content,
  category: postCategoryToDomain(p.category),
  imageUrl: p.imageUrl ?? undefined,
  tags: p.tags,
  pinned: p.pinned,
  hidden: p.hidden,
  likesCount: p.likesCount,
  commentsCount: p.commentsCount,
  createdAt: p.createdAt.toISOString(),
  editedAt: p.editedAt?.toISOString(),
  poll: (p.poll as unknown as PollDef | null) ?? undefined,
});

const toComment = (c: DbComment): Comment => ({
  id: c.id,
  postId: c.postId,
  authorId: c.authorId,
  content: c.content,
  hidden: c.hidden,
  createdAt: c.createdAt.toISOString(),
  editedAt: c.editedAt?.toISOString(),
});

const isNotFound = (e: unknown) => (e as { code?: string }).code === 'P2025';
/** Chuẩn hóa thẻ trong SQL giống normTag của service: trim, bỏ 1 dấu '#' đầu, chữ thường. */
const NORM_TAG_SQL = (col: Prisma.Sql) => Prisma.sql`lower(regexp_replace(btrim(${col}), '^#', ''))`;

export const postsRepository: PostsRepository = {
  async list({ courseId, category, tag, sort, page, limit, seeHidden, viewerId }) {
    const skip = (page - 1) * limit;
    if (!tag) {
      const where: Prisma.PostWhereInput = {
        courseId,
        ...(category ? { category: postCategoryFromDomain(category) } : {}),
        ...(seeHidden ? {} : { OR: [{ hidden: false }, ...(viewerId ? [{ authorId: viewerId }] : [])] }),
      };
      const orderBy: Prisma.PostOrderByWithRelationInput[] =
        sort === 'popular'
          ? [{ pinned: 'desc' }, { likesCount: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }]
          : [{ pinned: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }];
      const [rows, total] = await Promise.all([prisma.post.findMany({ where, orderBy, skip, take: limit }), prisma.post.count({ where })]);
      return { items: rows.map(toPost), total };
    }

    // Lọc theo thẻ cần unnest mảng -> truy vấn thô; chỉ lấy id đã sắp xếp/phân trang rồi nạp bản ghi.
    const conds: Prisma.Sql[] = [
      Prisma.sql`p."courseId" = ${courseId}`,
      Prisma.sql`EXISTS (SELECT 1 FROM unnest(p."tags") AS t(v) WHERE ${NORM_TAG_SQL(Prisma.sql`t.v`)} = ${tag})`,
    ];
    if (category) conds.push(Prisma.sql`p."category" = ${category}::"PostCategory"`);
    if (!seeHidden) conds.push(viewerId ? Prisma.sql`(NOT p."hidden" OR p."authorId" = ${viewerId})` : Prisma.sql`NOT p."hidden"`);
    const whereSql = Prisma.join(conds, ' AND ');
    const order =
      sort === 'popular'
        ? Prisma.sql`p."pinned" DESC, p."likesCount" DESC, p."createdAt" DESC, p."id" ASC`
        : Prisma.sql`p."pinned" DESC, p."createdAt" DESC, p."id" ASC`;
    const [idRows, countRows] = await Promise.all([
      prisma.$queryRaw<{ id: string }[]>`SELECT p."id" FROM "Post" p WHERE ${whereSql} ORDER BY ${order} LIMIT ${limit} OFFSET ${skip}`,
      prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM "Post" p WHERE ${whereSql}`,
    ]);
    const ids = idRows.map((r) => r.id);
    const rows = await prisma.post.findMany({ where: { id: { in: ids } } });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return { items: ids.map((id) => byId.get(id)).filter((r): r is DbPost => !!r).map(toPost), total: countRows[0]?.n ?? 0 };
  },

  async popularTags(courseId, limit) {
    // Mỗi bài chỉ tính 1 lần cho mỗi thẻ chuẩn hóa; tag hiển thị = dạng của bài mới nhất chứa thẻ đó.
    const norm = NORM_TAG_SQL(Prisma.sql`u.v`);
    const rows = await prisma.$queryRaw<{ tag: string; count: number }[]>`
      SELECT (array_agg(x.v ORDER BY x."createdAt" DESC))[1] AS tag, count(*)::int AS count
      FROM (
        SELECT DISTINCT ON (p."id", ${norm}) u.v AS v, ${norm} AS n, p."createdAt" AS "createdAt"
        FROM "Post" p, unnest(p."tags") AS u(v)
        WHERE p."courseId" = ${courseId} AND NOT p."hidden"
        ORDER BY p."id", ${norm}
      ) x
      GROUP BY x.n
      ORDER BY count DESC, x.n ASC
      LIMIT ${limit}`;
    return rows;
  },

  async findById(postId) {
    const p = await prisma.post.findUnique({ where: { id: postId } });
    return p ? toPost(p) : undefined;
  },

  async create(courseId, authorId, content, category, tags, imageUrl, poll) {
    const p = await prisma.post.create({
      data: {
        courseId,
        authorId,
        content,
        category: postCategoryFromDomain(category),
        tags,
        imageUrl,
        poll: poll ? (poll as unknown as Prisma.InputJsonValue) : undefined,
      },
    });
    return toPost(p);
  },

  async update(postId, patch) {
    try {
      const p = await prisma.post.update({
        where: { id: postId },
        data: {
          ...(patch.content !== undefined ? { content: patch.content } : {}),
          ...(patch.category !== undefined ? { category: postCategoryFromDomain(patch.category) } : {}),
          ...(patch.tags !== undefined ? { tags: patch.tags } : {}),
          editedAt: new Date(),
        },
      });
      return toPost(p);
    } catch (e) {
      if (isNotFound(e)) return undefined;
      throw e;
    }
  },

  async delete(postId) {
    await prisma.post.deleteMany({ where: { id: postId } });
  },

  async setPinned(postId, pinned) {
    await prisma.post.updateMany({ where: { id: postId }, data: { pinned } });
  },

  async setHidden(postId, hidden) {
    await prisma.post.updateMany({ where: { id: postId }, data: { hidden } });
  },

  async isLiked(postId, userId) {
    return (await prisma.postLike.count({ where: { postId, userId } })) > 0;
  },

  async likedPostIds(postIds, userId) {
    if (postIds.length === 0) return new Set();
    const rows = await prisma.postLike.findMany({ where: { userId, postId: { in: postIds } }, select: { postId: true } });
    return new Set(rows.map((r) => r.postId));
  },

  async toggleLike(postId, userId) {
    return prisma.$transaction(async (tx) => {
      // Khóa hàng bài để hai thao tác like/unlike song song của cùng bài được tuần tự hóa (likesCount luôn khớp số PostLike).
      const locked = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Post" WHERE "id" = ${postId} FOR UPDATE`;
      if (locked.length === 0) return false;
      const removed = await tx.postLike.deleteMany({ where: { postId, userId } });
      if (removed.count > 0) {
        await tx.$executeRaw`UPDATE "Post" SET "likesCount" = GREATEST("likesCount" - 1, 0) WHERE "id" = ${postId}`;
        return false;
      }
      await tx.postLike.create({ data: { postId, userId } });
      await tx.post.update({ where: { id: postId }, data: { likesCount: { increment: 1 } } });
      return true;
    });
  },

  async markLikeNotified(postId, userId) {
    const r = await prisma.postLikeNotice.createMany({ data: [{ postId, userId }], skipDuplicates: true });
    return r.count === 1;
  },

  async listComments(postId) {
    const rows = await prisma.postComment.findMany({ where: { postId }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    return rows.map(toComment);
  },

  async findComment(commentId) {
    const c = await prisma.postComment.findUnique({ where: { id: commentId } });
    return c ? toComment(c) : undefined;
  },

  async addComment(postId, authorId, content) {
    return prisma.$transaction(async (tx) => {
      const c = await tx.postComment.create({ data: { postId, authorId, content } });
      await tx.post.update({ where: { id: postId }, data: { commentsCount: { increment: 1 } } });
      return toComment(c);
    });
  },

  async updateComment(commentId, content) {
    try {
      return toComment(await prisma.postComment.update({ where: { id: commentId }, data: { content, editedAt: new Date() } }));
    } catch (e) {
      if (isNotFound(e)) return undefined;
      throw e;
    }
  },

  async deleteComment(commentId) {
    await prisma.$transaction(async (tx) => {
      const removed = await tx.postComment.findUnique({ where: { id: commentId }, select: { postId: true } });
      if (!removed) return;
      const r = await tx.postComment.deleteMany({ where: { id: commentId } });
      if (r.count > 0) {
        await tx.$executeRaw`UPDATE "Post" SET "commentsCount" = GREATEST("commentsCount" - 1, 0) WHERE "id" = ${removed.postId}`;
      }
    });
  },

  async setCommentHidden(commentId, hidden) {
    await prisma.postComment.updateMany({ where: { id: commentId }, data: { hidden } });
  },

  async setVote(postId, userId, optionIds) {
    await prisma.$transaction(async (tx) => {
      await tx.pollVote.deleteMany({ where: { postId, userId } });
      if (optionIds.length > 0) {
        await tx.pollVote.createMany({ data: optionIds.map((optionId) => ({ postId, userId, optionId })), skipDuplicates: true });
      }
    });
  },

  async getVotes(postId) {
    return (await this.getVotesMany([postId])).get(postId) ?? new Map();
  },

  async getVotesMany(postIds) {
    const out = new Map<string, Map<string, string[]>>();
    if (postIds.length === 0) return out;
    const rows = await prisma.pollVote.findMany({ where: { postId: { in: postIds } }, orderBy: { createdAt: 'asc' } });
    for (const r of rows) {
      const perPost = out.get(r.postId) ?? new Map<string, string[]>();
      const list = perPost.get(r.userId) ?? [];
      list.push(r.optionId);
      perPost.set(r.userId, list);
      out.set(r.postId, perPost);
    }
    return out;
  },
};

/** @deprecated Tên cũ; dùng `postsRepository`. */
export const inMemoryPostsRepository: PostsRepository = postsRepository;
