import { Router } from 'express';
import { env } from '../../config/env.js';
import { mailService } from './mail.service.js';

export const mailRouter = Router();

// Chỉ tồn tại ngoài production: để dev/test lấy link reset/verify (token không bao giờ có trong response API thật).
if (env.NODE_ENV !== 'production') {
  mailRouter.get('/dev/outbox', (req, res) => {
    const to = typeof req.query.to === 'string' ? req.query.to : undefined;
    res.json({ data: mailService.listOutbox(to) });
  });
}
