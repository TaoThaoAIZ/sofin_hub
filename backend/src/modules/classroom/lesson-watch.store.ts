import { createHash } from 'node:crypto';
import { prisma } from '../../db/prisma.js';
import type { LessonAttachment } from './classroom.types.js';

type WithVideos = { videoUrl?: string | undefined; attachments?: LessonAttachment[] | null | undefined };

/** Khóa theo dõi của từng video trong bài, đúng thứ tự hiển thị: video chính ('main') rồi các video bổ sung (mã băm URL, đổi video thì khóa đổi). */
export function lessonVideoKeys(lesson: WithVideos): string[] {
  const extras = (lesson.attachments ?? []).filter((a) => a.kind === 'video').map((a) => createHash('sha1').update(a.url).digest('hex').slice(0, 16));
  return [...(lesson.videoUrl ? ['main'] : []), ...extras];
}

/** Đã xem hết video bài học (dùng chung giữa classroom.service và quiz.service, tránh vòng phụ thuộc). */
export const lessonWatchStore = {
  /** Tập khóa video đã xem hết của người dùng trong bài. */
  async watchedKeys(userId: string, lessonId: string): Promise<Set<string>> {
    const rows = await prisma.lessonVideoWatch.findMany({ where: { userId, lessonId }, select: { videoKey: true } });
    return new Set(rows.map((r) => r.videoKey));
  },
  /** Đã xem hết MỌI video của bài (bài không có video thì coi như đã xem). */
  async hasWatchedAll(userId: string, lesson: WithVideos & { id: string }): Promise<boolean> {
    const keys = lessonVideoKeys(lesson);
    if (keys.length === 0) return true;
    const watched = await this.watchedKeys(userId, lesson.id);
    return keys.every((k) => watched.has(k));
  },
  async markWatched(userId: string, lessonId: string, videoKey = 'main'): Promise<void> {
    await prisma.lessonVideoWatch.upsert({
      where: { userId_lessonId_videoKey: { userId, lessonId, videoKey } },
      create: { userId, lessonId, videoKey },
      update: {},
    });
  },
};
