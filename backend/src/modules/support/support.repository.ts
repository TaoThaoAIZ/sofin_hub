import { prisma } from '../../db/prisma.js';

/** Danh sách nhận bản tin (bảng NewsletterSubscriber, email chữ thường, unique). */
export interface NewsletterRepository {
  /** Trả về true nếu đây là lần đăng ký mới (hoặc đăng ký lại sau khi hủy). */
  subscribe(email: string): Promise<boolean>;
  /** Trả về true nếu email đang đăng ký và đã được hủy. */
  unsubscribe(email: string): Promise<boolean>;
}

export const prismaNewsletterRepository: NewsletterRepository = {
  async subscribe(email) {
    // Nguyên tử, không race: INSERT ... ON CONFLICT chỉ "sống lại" dòng đã hủy; dòng đang đăng ký không trả về gì.
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO "NewsletterSubscriber" (id, email, "subscribedAt")
      VALUES (${crypto.randomUUID()}, ${email}, NOW())
      ON CONFLICT (email) DO UPDATE SET "unsubscribedAt" = NULL, "subscribedAt" = NOW()
        WHERE "NewsletterSubscriber"."unsubscribedAt" IS NOT NULL
      RETURNING id`;
    return rows.length > 0;
  },

  async unsubscribe(email) {
    const r = await prisma.newsletterSubscriber.updateMany({ where: { email, unsubscribedAt: null }, data: { unsubscribedAt: new Date() } });
    return r.count > 0;
  },
};
