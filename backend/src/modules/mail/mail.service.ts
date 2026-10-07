import { randomUUID } from 'node:crypto';
import nodemailer from 'nodemailer';
import { env, isProd } from '../../config/env.js';

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

/** SMTP thật qua nodemailer (Gmail App Password / Brevo / Resend SMTP...). Chỉ dựng khi có SMTP_HOST. */
export function createSmtpMailProvider(): MailProvider {
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    // Mặc định nodemailer chờ tới 2 phút khi cổng bị chặn => request đăng ký/quên mật khẩu treo. Thất bại nhanh để API còn trả lời.
    connectionTimeout: 8_000,
    greetingTimeout: 8_000,
    socketTimeout: 15_000,
  });
  return {
    async send(m) {
      await transport.sendMail({ from: env.MAIL_FROM, to: m.to, subject: m.subject, text: m.text, html: m.html });
    },
  };
}

/** Brevo HTTP API (https://developers.brevo.com): người gửi trong MAIL_FROM phải là "Sender" đã xác minh trong tài khoản Brevo. */
export function createBrevoMailProvider(): MailProvider {
  const m = /^\s*(?:"?([^"<]*?)"?\s*)?<([^>]+)>\s*$/.exec(env.MAIL_FROM);
  const sender = m ? { name: m[1]?.trim() || undefined, email: m[2]!.trim() } : { email: env.MAIL_FROM.trim() };
  return {
    async send(msg) {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': env.BREVO_API_KEY!, 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({ sender, to: [{ email: msg.to }], subject: msg.subject, textContent: msg.text, ...(msg.html ? { htmlContent: msg.html } : {}) }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`);
    },
  };
}

// BREVO_API_KEY (HTTP) > SMTP_HOST (SMTP) thật; không có thì (kể cả dev, để thử); không thì dev/test = outbox RAM, production = log-only.
let provider: MailProvider = process.env.NODE_ENV !== 'test' && env.BREVO_API_KEY ? createBrevoMailProvider() : env.SMTP_HOST && process.env.NODE_ENV !== 'test' ? createSmtpMailProvider() : isProd ? logOnlyMailProvider : memoryMailProvider;
// Outbox in-memory CHỈ dành cho dev/test (không bao giờ dùng khi production: lộ token, mất khi restart, lệch giữa instance).
// Production mặc định log-only => thư reset/verify bị bỏ: cảnh báo to ngay lúc khởi động để không bị bỏ sót.
if (isProd && !env.SMTP_HOST && !env.BREVO_API_KEY) console.warn('[mail] CẢNH BÁO: production đang dùng provider log-only — email (đặt lại mật khẩu, xác thực...) KHÔNG được gửi. Đặt SMTP_HOST (+SMTP_USER/SMTP_PASS/MAIL_FROM) hoặc gọi setMailProvider() với SES trước khi mở cho người dùng thật.');

export function setMailProvider(p: MailProvider) {
  provider = p;
}

export const mailService = {
  /** Trả true nếu provider nhận thư. Lỗi KHÔNG ném ra (forgot-password không được lộ trạng thái); caller cần biết (OTP) thì xem kết quả. */
  async send(message: MailMessage): Promise<boolean> {
    try {
      await provider.send(message);
      return true;
    } catch (err) {
      console.error('[mail] gửi thất bại:', err instanceof Error ? err.message : err);
      return false;
    }
  },

  /** Chỉ dùng cho test: xóa thư của một địa chỉ khỏi outbox. */
  dropOutbox(to: string): void {
    const target = to.trim().toLowerCase();
    for (let i = outbox.length - 1; i >= 0; i--) if (outbox[i]!.to.toLowerCase() === target) outbox.splice(i, 1);
  },

  /** Chỉ dùng cho dev/test. */
  listOutbox(to?: string): OutboxEntry[] {
    const target = to?.trim().toLowerCase();
    return outbox.filter((m) => !target || m.to.toLowerCase() === target);
  },
};
