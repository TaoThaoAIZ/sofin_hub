import { prisma } from '../../db/prisma.js';

/**
 * Nhả cờ chống-trùng `PostLikeNotice` của (bài, người like) khi ghi thông báo "bài được thích" thất bại HẲN (sau retry):
 * lần like kế tiếp của người này được thông báo lại thay vì tác giả vĩnh viễn không biết (AUDIT §6.3).
 * Điểm thưởng không bị cộng lại vì `pointsService.award` idempotent theo nguồn `post_like:{postId}:{viewerId}`.
 */
export async function releaseLikeNotice(postId: string, userId: string): Promise<void> {
  await prisma.postLikeNotice.deleteMany({ where: { postId, userId } });
}
