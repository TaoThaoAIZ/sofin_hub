import { Router } from 'express';
import { env } from '../../config/env.js';
import { mailService } from './mail.service.js';

export const mailRouter = Router();

// Chỉ mount khi bật tường minh ENABLE_DEV_OUTBOX=1 (KHÔNG dựa vào NODE_ENV: quên đặt NODE_ENV không được mở hộp thư công khai).
// Để dev/test lấy link reset/verify (token không bao giờ có trong response API thật). Production cấm bật (env-guard).
if (env.ENABLE_DEV_OUTBOX) {
  mailRouter.get('/dev/outbox', (req, res) => {
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    res.json({ data: mailService.listOutbox(to) });
  });
}
