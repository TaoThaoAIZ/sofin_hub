import { prisma } from '../../db/prisma.js';

/**
 * Ghim bài "Thông báo" <=> thông báo popup (docs/features/community-greetings.md). Gọi từ posts.service khi ghim / bỏ ghim — chỉ dùng
 * prisma (không import posts.service) để tránh vòng import.
 * - Ghim bài mục "Thông báo" => tạo (hoặc bật lại) thông báo popup; mốc createdAt = lúc ghim (người tham gia trước mốc này mới thấy).
 * - Bỏ ghim => thôi hiện popup. Xóa bài => thông báo bị xóa theo (FK cascade).
 */
export async function syncPinnedAnnouncement(postId: string, pinned: boolean): Promise<void> {
  const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, communityId: true, authorId: true, category: true, content: true } });
  if (!post) return;
  const existing = await prisma.communityAnnouncement.findUnique({ where: { postId }, select: { id: true } });
  if (!pinned || post.category !== 'announcement') {
    if (existing) await prisma.communityAnnouncement.update({ where: { postId }, data: { active: false } });
    return;
  }
  const { title, body } = splitPost(post.content);
  if (existing) {
    await prisma.communityAnnouncement.update({ where: { postId }, data: { active: true, title, body } });
    return;
  }
  await prisma.communityAnnouncement.create({ data: { communityId: post.communityId, authorId: post.authorId, postId, title, body } });
}

/** Dòng đầu = tiêu đề (≤120 ký tự), phần còn lại = nội dung. */
export function splitPost(content: string): { title: string; body: string } {
  const text = content.trim();
  const nl = text.indexOf('\n');
  const first = (nl < 0 ? text : text.slice(0, nl)).trim();
  if (first.length <= 120) return { title: first, body: nl < 0 ? '' : text.slice(nl + 1).trim().slice(0, 2000) };
  return { title: `${first.slice(0, 117).trimEnd()}…`, body: text.slice(0, 2000) };
}
