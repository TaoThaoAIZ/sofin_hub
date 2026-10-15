import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { HttpError } from '../../utils/http-error.js';

export const STEP_KEYS = ['video', 'comment', 'app'] as const;
export type StepKey = (typeof STEP_KEYS)[number];
/** Bước người dùng tự bấm (bước `comment` được tính từ bình luận thật nên không đánh dấu tay được). */
export const markStepParam = z.enum(['video', 'app'], { error: 'Bước không hợp lệ (video | app)' });

export const onboardingService = {
  /**
   * Danh sách bước của người xem trong cộng đồng: video (chỉ có khi cộng đồng có video giới thiệu), comment (đã bình luận ít nhất
   * 1 bài trong cộng đồng — tính từ dữ liệu thật), app. `completed` = mọi bước đã xong.
   */
  async get(communityId: string, userId: string) {
    const [community, row, comments] = await Promise.all([
      prisma.community.findFirst({ where: { id: communityId, deletedAt: null }, select: { introVideoUrl: true } }),
      prisma.communityOnboarding.findUnique({ where: { userId_communityId: { userId, communityId } } }),
      prisma.postComment.count({ where: { authorId: userId, removedAt: null, hidden: false, post: { communityId, removedAt: null } } }),
    ]);
    if (!community) throw HttpError.notFound('Không tìm thấy cộng đồng');
    const steps: Array<{ key: StepKey; done: boolean }> = [];
    if (community.introVideoUrl) steps.push({ key: 'video', done: !!row?.videoAt });
    steps.push({ key: 'comment', done: comments > 0 });
    steps.push({ key: 'app', done: !!row?.appAt });
    const done = steps.filter((s) => s.done).length;
    return { steps, done, total: steps.length, completed: done === steps.length, videoUrl: community.introVideoUrl ?? null };
  },

  /** Đánh dấu một bước tự bấm là đã xong (idempotent: giữ thời điểm đầu tiên). */
  async mark(communityId: string, userId: string, step: 'video' | 'app') {
    const community = await prisma.community.findFirst({ where: { id: communityId, deletedAt: null }, select: { introVideoUrl: true } });
    if (!community) throw HttpError.notFound('Không tìm thấy cộng đồng');
    if (step === 'video' && !community.introVideoUrl) throw HttpError.badRequest('Cộng đồng này chưa có video giới thiệu');
    const field = step === 'video' ? 'videoAt' : 'appAt';
    const existing = await prisma.communityOnboarding.findUnique({ where: { userId_communityId: { userId, communityId } } });
    if (!existing) {
      await prisma.communityOnboarding.create({ data: { userId, communityId, [field]: new Date() } }).catch((e: { code?: string }) => {
        if (e.code !== 'P2002') throw e; // đua với request song song: dòng đã có, cập nhật bên dưới
      });
    }
    await prisma.communityOnboarding.updateMany({ where: { userId, communityId, [field]: null }, data: { [field]: new Date() } });
    return this.get(communityId, userId);
  },
};
