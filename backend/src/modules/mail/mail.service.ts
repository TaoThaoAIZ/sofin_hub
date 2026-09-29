import { randomUUID } from 'node:crypto';
import { isProd } from '../../config/env.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface MailProvider {
  send(message: MailMessage): Promise<void>;
}

export interface OutboxEntry extends MailMessage {
  id: string;
  sentAt: string;
}

const OUTBOX_LIMIT = 200;
const outbox: OutboxEntry[] = [];

/** Dev/test: giữ thư trong bộ nhớ để lấy link reset/verify qua GET /dev/outbox (không gửi thật). */
export const memoryMailProvider: MailProvider = {
  async send(message) {
    outbox.push({ ...message, id: randomUUID(), sentAt: new Date().toISOString() });
    if (outbox.length > OUTBOX_LIMIT) outbox.shift();
    if (process.env.NODE_ENV !== 'test') console.log(`[mail] -> ${message.to} | ${message.subject}`);
  },
};

/**
 * Production khi chưa nối nhà cung cấp thật: chỉ log, KHÔNG lưu/ghi nội dung (thư chứa token).
 *
 * Nối AWS SES (PLAN đề xuất): cài `@aws-sdk/client-sesv2`, viết
 *   const ses = new SESv2Client({ region });
 *   send: (m) => ses.send(new SendEmailCommand({ FromEmailAddress, Destination: { ToAddresses: [m.to] },
 *     Content: { Simple: { Subject: { Data: m.subject }, Body: { Text: { Data: m.text }, Html: m.html ? { Data: m.html } : undefined } } } }))
 * rồi gán vào mailService qua setMailProvider(). SMTP (nodemailer) làm tương tự.
 */
export const logOnlyMailProvider: MailProvider = {
  async send(message) {
    console.warn(`[mail] chưa cấu hình nhà cung cấp email, bỏ qua thư tới ${message.to} (${message.subject})`);
  },
};

let provider: MailProvider = isProd ? logOnlyMailProvider : memoryMailProvider;

export function setMailProvider(p: MailProvider) {
  provider = p;
}

export const mailService = {
  async send(message: MailMessage): Promise<void> {
    // Lỗi gửi mail không được làm hỏng request chính (đặc biệt forgot-password không được lộ trạng thái).
    try {
      await provider.send(message);
    } catch (err) {
      console.error('[mail] gửi thất bại:', err instanceof Error ? err.message : err);
    }
  },

  /** Chỉ dùng cho dev/test. */
  listOutbox(to?: string): OutboxEntry[] {
    const target = to?.trim().toLowerCase();
    return outbox.filter((m) => !target || m.to.toLowerCase() === target);
  },
};
