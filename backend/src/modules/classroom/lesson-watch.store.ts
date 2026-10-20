import { prisma } from '../../db/prisma.js';

/** Đã xem hết video bài học (dùng chung giữa classroom.service và quiz.service, tránh vòng phụ thuộc). */
export const lessonWatchStore = {
  async hasWatched(userId: string, lessonId: string): Promise<boolean> {
    return (await prisma.lessonVideoWatch.count({ where: { userId, lessonId } })) > 0;
  },
  async markWatched(userId: string, lessonId: string): Promise<void> {
    await prisma.lessonVideoWatch.upsert({ where: { userId_lessonId: { userId, lessonId } }, create: { userId, lessonId }, update: {} });
  },
};
