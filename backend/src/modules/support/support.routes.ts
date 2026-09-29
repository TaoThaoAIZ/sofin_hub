import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { HttpError } from '../../utils/http-error.js';
import { contactBody, newsletterBody } from './support.schema.js';
import { supportService } from './support.service.js';

export const supportRouter = Router();

// Chống spam theo IP; test chạy từ 1 IP nên nới rất lớn.
const limiter = (limit: number) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: process.env.NODE_ENV === 'test' ? 100_000 : limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) => next(HttpError.tooMany('Bạn thao tác quá nhiều lần, vui lòng thử lại sau ít phút')),
  });

supportRouter.post('/newsletter', limiter(10), async (req, res) => {
  const { email } = newsletterBody.parse(req.body);
  res.json({ data: await supportService.subscribe(email) });
});

supportRouter.post('/newsletter/unsubscribe', limiter(10), async (req, res) => {
  const { email } = newsletterBody.parse(req.body);
  res.json({ data: await supportService.unsubscribe(email) });
});

supportRouter.post('/contact', limiter(5), async (req, res) => {
  await supportService.contact(contactBody.parse(req.body));
  res.status(202).json({ data: { message: 'Chúng tôi đã nhận được tin nhắn và sẽ phản hồi sớm.' } });
});
