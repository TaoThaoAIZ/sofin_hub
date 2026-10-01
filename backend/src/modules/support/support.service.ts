import { cfg } from '../settings/settings.service.js';
import { userRepository } from '../auth/auth.repository.js';
import { createTicket } from './tickets.core.js';
import { mailService } from '../mail/mail.service.js';
import type { ContactBody } from './support.schema.js';
import { prismaNewsletterRepository, type NewsletterRepository } from './support.repository.js';

export function createSupportService(repo: NewsletterRepository = prismaNewsletterRepository) {
  return {
    /** Idempotent: đăng ký lại vẫn trả subscribed=true nhưng không gửi thêm thư chào. */
    async subscribe(email: string): Promise<{ subscribed: true }> {
      const isNew = await repo.subscribe(email);
      if (isNew) {
        await mailService.send({
          to: email,
          subject: 'Chào mừng bạn đến với bản tin SofinHub',
          text: 'Cảm ơn bạn đã đăng ký nhận bản tin SofinHub! Bạn có thể hủy đăng ký bất cứ lúc nào.',
        });
      }
      return { subscribed: true };
    },

    // Bản thật cần token hủy trong link ở email (nếu không ai cũng hủy được email của người khác).
    async unsubscribe(email: string): Promise<{ unsubscribed: true }> {
      await repo.unsubscribe(email);
      return { unsubscribed: true };
    },

    async contact(body: ContactBody): Promise<void> {
      await mailService.send({
        to: cfg().platform.supportEmail,
        subject: `[Liên hệ] ${body.subject}`,
        text: `Từ: ${body.name} <${body.email}>

${body.message}`,
      });
      // Đồng thời tạo ticket để đội hỗ trợ xử lý trong Admin (liên kết user nếu email khớp tài khoản).
      const user = await userRepository.findByEmail(body.email);
      await createTicket({
        subject: body.subject,
        message: body.message,
        category: body.category,
        requesterId: user?.id ?? null,
        requesterName: body.name,
        requesterEmail: body.email,
        source: 'contact_form',
      });
    },
  };
}

export const supportService = createSupportService();
