import { prisma, type Tx } from '../../db/prisma.js';
import { HttpError } from '../../utils/http-error.js';
import type { Prisma, Invite as DbInvite, JoinRequest as DbJoinRequest, Review as DbReview } from '../../generated/prisma/client.js';
import { seedCommunities } from '../catalog/catalog.seed.js';
import type { BanRecord, Invite, JoinRequest, JoinRequestStatus, Review } from './communities.types.js';

/**
 * Postgres qua Prisma. Trạng thái "bị cấm" thật là dòng CommunityBan (enrollmentService.setBanned ghi/xóa, kèm lý do + người cấm);
 * ở đây chỉ đọc lại để liệt kê. Khóa cộng đồng nằm ở Course.locked/lockReason (catalogService.update / getLockReason).
 */
export interface CommunitiesRepository {
  // yêu cầu tham gia
  /** Tạo yêu cầu pending; trả `undefined` nếu (community,user) đã có yêu cầu pending (kiểm tra + ghi trong 1 transaction có khóa). */
  createPendingJoinRequest(r: JoinRequest): Promise<JoinRequest | undefined>;
  findJoinRequest(id: string): Promise<JoinRequest | undefined>;
  findPendingJoinRequest(communityId: string, userId: string): Promise<JoinRequest | undefined>;
  listJoinRequests(communityId: string, status?: JoinRequestStatus): Promise<JoinRequest[]>;
  /** Chuyển pending -> approved/rejected; `undefined` nếu yêu cầu không còn pending (đã có người xử lý). */
  decideJoinRequest(id: string, status: 'approved' | 'rejected', decidedBy: string | undefined): Promise<JoinRequest | undefined>;
  /**
   * Quyết định yêu cầu + cấp quyền trong CÙNG 1 transaction: chốt pending→approved/rejected TRƯỚC (atomic); chỉ khi chốt thành công và `grant`
   * mới tạo Enrollment (người bị cấm ⇒ 409, rollback cả quyết định). `undefined` nếu đã có người xử lý.
   */
  decideJoinRequestAndGrant(id: string, status: 'approved' | 'rejected', decidedBy: string, grant: boolean): Promise<JoinRequest | undefined>;
  hasApprovedJoinRequest(communityId: string, userId: string): Promise<boolean>;
  /** Lời mời cho cộng đồng riêng tư CÓ PHÍ: ghi 1 yêu cầu đã duyệt để người nhận được phép thanh toán (không cấp quyền). */
  createApprovedJoinRequest(communityId: string, userId: string, decidedBy: string): Promise<void>;
  /** Kick: các lần duyệt trước đó hết hiệu lực (approved → rejected) để không mua lại mà bỏ qua cổng duyệt. */
  revokeApprovedJoinRequests(communityId: string, userId: string): Promise<void>;
  deleteJoinRequest(id: string): Promise<void>;
  // lời mời
  createInvite(i: Invite): Promise<Invite>;
  findInvite(code: string): Promise<Invite | undefined>;
  listInvites(communityId: string): Promise<Invite[]>;
  revokeInvite(code: string): Promise<void>;
  /** Tăng usedCount nếu còn lượt (atomic). false = hết lượt. */
  claimInviteUse(code: string): Promise<boolean>;
  releaseInviteUse(code: string): Promise<void>;
  // ban (đọc)
  listBans(communityId: string): Promise<BanRecord[]>;
  // đánh giá
  findReviewById(id: string): Promise<Review | undefined>;
  findReview(communityId: string, userId: string): Promise<Review | undefined>;
  listReviews(communityId: string, opts?: { skip?: number; take?: number }): Promise<Review[]>;
  countReviews(communityId: string): Promise<number>;
  /** Thêm/sửa đánh giá + tính lại Course.rating/ratingCount trong CÙNG transaction (khóa hàng Course). */
  upsertReview(communityId: string, userId: string, rating: number, text: string): Promise<{ review: Review; created: boolean }>;
  /** Xóa đánh giá + tính lại điểm Course trong cùng transaction. */
  deleteReview(id: string): Promise<void>;
  // người dùng minh họa
  demoUserIds(userIds: string[]): Promise<Set<string>>;
}

const iso = (d: Date) => d.toISOString();

const toJoinRequest = (r: DbJoinRequest): JoinRequest => ({
  id: r.id,
  communityId: r.communityId,
  courseId: r.communityId,
  userId: r.userId,
  message: r.message,
  answers: Array.isArray(r.answers) ? (r.answers as unknown as JoinRequest['answers']) : [],
  rulesAcceptedAt: r.rulesAcceptedAt?.toISOString(),
  status: r.status,
  createdAt: iso(r.createdAt),
  ...(r.decidedById ? { decidedBy: r.decidedById } : {}),
  ...(r.decidedAt ? { decidedAt: iso(r.decidedAt) } : {}),
});

const toInvite = (i: DbInvite): Invite => ({
  code: i.code,
  communityId: i.communityId,
  courseId: i.communityId,
  createdBy: i.createdById,
  maxUses: i.maxUses,
  usedCount: i.usedCount,
  expiresAt: i.expiresAt ? iso(i.expiresAt) : null,
  revokedAt: i.revokedAt ? iso(i.revokedAt) : null,
  createdAt: iso(i.createdAt),
});

const toReview = (r: DbReview): Review => ({
  id: r.id,
  communityId: r.communityId,
  courseId: r.communityId,
  userId: r.userId,
  rating: r.rating,
  text: r.text,
  createdAt: iso(r.createdAt),
  updatedAt: iso(r.updatedAt),
});

/** Điểm nền của cộng đồng seed (rating/ratingCount minh họa); cộng đồng người dùng tạo có nền 0/0. */
const baselines = new Map(seedCommunities.map((c) => [c.id, { rating: c.rating, count: c.ratingCount }]));
export const ratingBaselineOf = (communityId: string) => baselines.get(communityId) ?? { rating: 0, count: 0 };

/**
 * Tính lại Course.rating/ratingCount = (điểm nền seed + đánh giá thật) từ nguồn sự thật (bảng Review), không cộng dồn
 * nên không trôi số do làm tròn. Gọi TRONG transaction sau khi khóa hàng Course.
 */
export async function recalcCourseRating(tx: Tx, communityId: string): Promise<void> {
  const agg = await tx.review.aggregate({ where: { communityId }, _count: { _all: true }, _sum: { rating: true } });
  const base = ratingBaselineOf(communityId);
  const realCount = agg._count._all;
  const total = base.count + realCount;
  const sum = base.rating * base.count + (agg._sum.rating ?? 0);
  await tx.community.updateMany({
    where: { id: communityId },
    data: { ratingCount: total, rating: total === 0 ? 0 : Math.round((sum / total) * 10) / 10 },
  });
}

async function lockCourse(tx: Tx, communityId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "Course" WHERE "id" = ${communityId} FOR UPDATE`;
}

export const communitiesRepository: CommunitiesRepository = {
  async createPendingJoinRequest(r) {
    return prisma.$transaction(async (tx) => {
      // Khóa cố vấn theo (community,user): hai yêu cầu song song của cùng người không thể cùng qua bước kiểm tra.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`joinreq:${r.communityId}:${r.userId}`}))`;
      const dup = await tx.joinRequest.findFirst({ where: { communityId: r.communityId, userId: r.userId, status: 'pending' } });
      if (dup) return undefined;
      const row = await tx.joinRequest.create({
        data: { id: r.id, communityId: r.communityId, userId: r.userId, message: r.message, answers: r.answers as unknown as Prisma.InputJsonValue, rulesAcceptedAt: r.rulesAcceptedAt ? new Date(r.rulesAcceptedAt) : null, status: 'pending', createdAt: new Date(r.createdAt) },
      });
      return toJoinRequest(row);
    });
  },
  async findJoinRequest(id) {
    const r = await prisma.joinRequest.findUnique({ where: { id } });
    return r ? toJoinRequest(r) : undefined;
  },
  async findPendingJoinRequest(communityId, userId) {
    const r = await prisma.joinRequest.findFirst({ where: { communityId, userId, status: 'pending' } });
    return r ? toJoinRequest(r) : undefined;
  },
  async listJoinRequests(communityId, status) {
    const rows = await prisma.joinRequest.findMany({
      where: { communityId, ...(status ? { status } : {}) },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return rows.map(toJoinRequest);
  },
  async decideJoinRequest(id, status, decidedBy) {
    const res = await prisma.joinRequest.updateMany({
      where: { id, status: 'pending' },
      data: { status, decidedById: decidedBy ?? null, decidedAt: new Date() },
    });
    if (res.count === 0) return undefined;
    const r = await prisma.joinRequest.findUnique({ where: { id } });
    return r ? toJoinRequest(r) : undefined;
  },
  async decideJoinRequestAndGrant(id, status, decidedBy, grant) {
    return prisma.$transaction(async (tx) => {
      const res = await tx.joinRequest.updateMany({ where: { id, status: 'pending' }, data: { status, decidedById: decidedBy, decidedAt: new Date() } });
      if (res.count === 0) return undefined;
      const r = await tx.joinRequest.findUniqueOrThrow({ where: { id } });
      if (grant) {
        if ((await tx.communityBan.count({ where: { communityId: r.communityId, userId: r.userId } })) > 0) throw HttpError.conflict('Người này đã bị cấm khỏi cộng đồng');
        await tx.enrollment.upsert({ where: { userId_communityId: { userId: r.userId, communityId: r.communityId } }, create: { userId: r.userId, communityId: r.communityId, role: 'member' }, update: {} });
      }
      return toJoinRequest(r);
    });
  },
  async hasApprovedJoinRequest(communityId, userId) {
    return (await prisma.joinRequest.count({ where: { communityId, userId, status: 'approved' } })) > 0;
  },
  async createApprovedJoinRequest(communityId, userId, decidedBy) {
    await prisma.joinRequest.create({ data: { communityId, userId, message: 'Lời mời', status: 'approved', decidedById: decidedBy, decidedAt: new Date() } });
  },
  async revokeApprovedJoinRequests(communityId, userId) {
    await prisma.joinRequest.updateMany({ where: { communityId, userId, status: 'approved' }, data: { status: 'rejected', decidedAt: new Date() } });
  },
  async deleteJoinRequest(id) {
    await prisma.joinRequest.deleteMany({ where: { id } });
  },

  async createInvite(i) {
    const row = await prisma.invite.create({
      data: {
        code: i.code,
        communityId: i.communityId,
        createdById: i.createdBy,
        maxUses: i.maxUses,
        usedCount: i.usedCount,
        expiresAt: i.expiresAt ? new Date(i.expiresAt) : null,
        createdAt: new Date(i.createdAt),
      },
    });
    return toInvite(row);
  },
  async findInvite(code) {
    const i = await prisma.invite.findUnique({ where: { code } });
    return i ? toInvite(i) : undefined;
  },
  async listInvites(communityId) {
    const rows = await prisma.invite.findMany({ where: { communityId }, orderBy: [{ createdAt: 'desc' }, { code: 'asc' }] });
    return rows.map(toInvite);
  },
  async revokeInvite(code) {
    await prisma.invite.updateMany({ where: { code, revokedAt: null }, data: { revokedAt: new Date() } });
  },
  async claimInviteUse(code) {
    // maxUses null = không giới hạn. So sánh cột với cột nên dùng SQL thô để điều kiện + tăng là một câu lệnh.
    const n = await prisma.$executeRaw`
      UPDATE "Invite" SET "usedCount" = "usedCount" + 1
      WHERE "code" = ${code} AND ("maxUses" IS NULL OR "usedCount" < "maxUses")`;
    return n > 0;
  },
  async releaseInviteUse(code) {
    await prisma.$executeRaw`UPDATE "Invite" SET "usedCount" = GREATEST("usedCount" - 1, 0) WHERE "code" = ${code}`;
  },

  async listBans(communityId) {
    const rows = await prisma.communityBan.findMany({ where: { communityId }, orderBy: [{ bannedAt: 'desc' }, { userId: 'asc' }] });
    return rows.map((b) => ({
      communityId: b.communityId,
  courseId: b.communityId,
      userId: b.userId,
      reason: b.reason,
      bannedBy: b.bannedById ?? '',
      bannedAt: iso(b.bannedAt),
    }));
  },

  async findReviewById(id) {
    const r = await prisma.review.findUnique({ where: { id } });
    return r ? toReview(r) : undefined;
  },
  async findReview(communityId, userId) {
    const r = await prisma.review.findUnique({ where: { communityId_userId: { communityId, userId } } });
    return r ? toReview(r) : undefined;
  },
  async listReviews(communityId, opts = {}) {
    const rows = await prisma.review.findMany({
      where: { communityId },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      skip: opts.skip,
      take: opts.take,
    });
    return rows.map(toReview);
  },
  countReviews: (communityId) => prisma.review.count({ where: { communityId } }),

  async upsertReview(communityId, userId, rating, text) {
    return prisma.$transaction(async (tx) => {
      await lockCourse(tx, communityId);
      const existing = await tx.review.findUnique({ where: { communityId_userId: { communityId, userId } } });
      const row = existing
        ? await tx.review.update({ where: { id: existing.id }, data: { rating, text } })
        : await tx.review.create({ data: { communityId, userId, rating, text } });
      await recalcCourseRating(tx, communityId);
      return { review: toReview(row), created: !existing };
    });
  },
  async deleteReview(id) {
    await prisma.$transaction(async (tx) => {
      const r = await tx.review.findUnique({ where: { id } });
      if (!r) return;
      await lockCourse(tx, r.communityId);
      await tx.review.deleteMany({ where: { id } });
      await recalcCourseRating(tx, r.communityId);
    });
  },

  async demoUserIds(userIds) {
    if (userIds.length === 0) return new Set();
    const rows = await prisma.user.findMany({ where: { id: { in: userIds }, isDemo: true }, select: { id: true } });
    return new Set(rows.map((r) => r.id));
  },
};
