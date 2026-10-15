import { Router, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middlewares/auth.js';
import { writeRateLimit } from '../../middlewares/rate-limit.js';
import { HttpError } from '../../utils/http-error.js';
import { chatbotService, type ChatEvent } from './chatbot.service.js';

/** Chatbot hỗ trợ (chỉ người đã đăng nhập). Contract: backend/docs/api/chatbot.md. */
export const chatbotRouter = Router();
const p = (v: string | string[] | undefined) => String(v);

const messageBody = z.object({ text: z.string().min(1, 'Vui lòng nhập nội dung').max(4000) });
const feedbackBody = z.object({ value: z.union([z.literal(-1), z.literal(0), z.literal(1)]) });

chatbotRouter.get('/chatbot/status', requireAuth, (_req, res) => {
  res.json({ data: chatbotService.status() });
});

chatbotRouter.get('/chatbot/conversations/current', requireAuth, async (req, res) => {
  res.json({ data: await chatbotService.current(req.userId!) });
});

chatbotRouter.post('/chatbot/conversations', requireAuth, writeRateLimit('general'), async (req, res) => {
  res.status(201).json({ data: await chatbotService.startConversation(req.userId!) });
});

/**
 * Gửi tin. `Accept: text/event-stream` => trả lời stream SSE ngay trên response này (event delta | replace | done | error);
 * ngược lại trả JSON `{ data: DoneData }` khi xong. Lỗi xảy ra TRƯỚC khi bắt đầu stream (503/400/404/409/429) trả JSON lỗi như thường.
 */
chatbotRouter.post('/chatbot/conversations/:id/messages', requireAuth, writeRateLimit('chatbot'), async (req, res, next) => {
  const { text } = messageBody.parse(req.body ?? {});
  const wantsStream = (req.get('accept') ?? '').includes('text/event-stream');
  if (!wantsStream) {
    res.json({ data: await chatbotService.sendMessage(req.userId!, p(req.params.id), text, () => undefined) });
    return;
  }
  let started = false;
  const write = (event: string, data: unknown) => {
    if (res.destroyed || res.writableEnded) return; // khách đóng widget: vẫn xử lý xong & lưu, chỉ không ghi nữa
    if (!started) startSse(res);
    started = true;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  try {
    await chatbotService.sendMessage(req.userId!, p(req.params.id), text, (e: ChatEvent) => write(e.event, e.data));
    if (!res.writableEnded) res.end();
  } catch (e) {
    if (!started) return next(e);
    const message = e instanceof HttpError ? e.message : 'Có lỗi xảy ra, vui lòng thử lại';
    write('error', { message });
    if (!res.writableEnded) res.end();
  }
});

chatbotRouter.post('/chatbot/conversations/:id/handoff', requireAuth, writeRateLimit('general'), async (req, res) => {
  res.json({ data: await chatbotService.handoff(req.userId!, p(req.params.id)) });
});

chatbotRouter.post('/chatbot/messages/:id/feedback', requireAuth, writeRateLimit('general'), async (req, res) => {
  const { value } = feedbackBody.parse(req.body ?? {});
  res.json({ data: await chatbotService.feedback(req.userId!, p(req.params.id), value) });
});

export function startSse(res: Response) {
  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    // no-transform: middleware compression bỏ qua => từng mẩu chữ tới ngay
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
}
