import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middlewares/auth.js';
import { writeRateLimit } from '../../middlewares/rate-limit.js';
import { HttpError } from '../../utils/http-error.js';
import { startSse } from '../chatbot/chatbot.routes.js';
import { communityBotAdminService, documentBody, patchDocumentBody, patchQaBody, patchSettingsBody, qaBody, qaQuery, conversationsQuery } from './community-bot.admin.js';
import { communityBotService, type CommunityChatEvent } from './community-bot.service.js';

/**
 * Chatbot riêng của cộng đồng (chatbot.md). Đường dẫn /courses/:id/bot/* (alias /communities/:id/bot/* qua community-alias).
 * Thành viên: status, hội thoại, gửi tin (SSE), 👍/👎, chọn nhân cách (VIP), gửi câu hỏi cho chủ. Chủ/admin: cài đặt, Q&A, tài liệu, hội thoại.
 * Contract: backend/docs/api/community-bot.md.
 */
export const communityBotRouter = Router();
const p = (v: string | string[] | undefined) => String(v);
const B = '/courses/:id/bot';

const messageBody = z.object({ text: z.string().min(1, 'Vui lòng nhập nội dung').max(4000) });
const feedbackBody = z.object({ value: z.union([z.literal(-1), z.literal(0), z.literal(1)]) });
const personaBody = z.object({ personaKey: z.string().max(40).nullable() });

// ------------------------------------------------------------------ thành viên
communityBotRouter.get(`${B}/status`, requireAuth, async (req, res) => {
  res.json({ data: await communityBotService.status(req.userId!, p(req.params.id)) });
});

communityBotRouter.get(`${B}/conversations/current`, requireAuth, async (req, res) => {
  res.json({ data: await communityBotService.current(req.userId!, p(req.params.id)) });
});

communityBotRouter.post(`${B}/conversations`, requireAuth, writeRateLimit('general'), async (req, res) => {
  res.status(201).json({ data: await communityBotService.startConversation(req.userId!, p(req.params.id)) });
});

/** Như POST /chatbot/conversations/:id/messages: `Accept: text/event-stream` => SSE; lỗi trước khi stream => JSON lỗi (403/404/409/429/503). */
communityBotRouter.post(`${B}/conversations/:cid/messages`, requireAuth, writeRateLimit('chatbot'), async (req, res, next) => {
  const { text } = messageBody.parse(req.body ?? {});
  const [userId, communityId, cid] = [req.userId!, p(req.params.id), p(req.params.cid)];
  if (!(req.get('accept') ?? '').includes('text/event-stream')) {
    res.json({ data: await communityBotService.sendMessage(userId, communityId, cid, text, () => undefined) });
    return;
  }
  let started = false;
  const write = (event: string, data: unknown) => {
    if (res.destroyed || res.writableEnded) return;
    if (!started) startSse(res);
    started = true;
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  try {
    await communityBotService.sendMessage(userId, communityId, cid, text, (e: CommunityChatEvent) => write(e.event, e.data));
    if (!res.writableEnded) res.end();
  } catch (e) {
    if (!started) return next(e);
    write('error', { message: e instanceof HttpError ? e.message : 'Có lỗi xảy ra, vui lòng thử lại' });
    if (!res.writableEnded) res.end();
  }
});

communityBotRouter.post(`${B}/conversations/:cid/handoff`, requireAuth, writeRateLimit('general'), async (req, res) => {
  res.json({ data: await communityBotService.handoff(req.userId!, p(req.params.id), p(req.params.cid)) });
});

communityBotRouter.post(`${B}/messages/:mid/feedback`, requireAuth, writeRateLimit('general'), async (req, res) => {
  const { value } = feedbackBody.parse(req.body ?? {});
  res.json({ data: await communityBotService.feedback(req.userId!, p(req.params.id), p(req.params.mid), value) });
});

communityBotRouter.put(`${B}/my-persona`, requireAuth, writeRateLimit('general'), async (req, res) => {
  const { personaKey } = personaBody.parse(req.body ?? {});
  res.json({ data: await communityBotService.setMyPersona(req.userId!, p(req.params.id), personaKey) });
});

/** Nhân cách mẫu (thẻ chọn + xem trước ví dụ) — không phụ thuộc cộng đồng. */
communityBotRouter.get('/chatbot/personas', requireAuth, (_req, res) => {
  res.json({ data: communityBotService.presets() });
});

// ------------------------------------------------------------------ chủ / admin cộng đồng
const body = (req: { body?: unknown }) => req.body ?? {};

communityBotRouter.get(`${B}/settings`, requireAuth, async (req, res) => {
  res.json({ data: await communityBotAdminService.getSettings(req.userId!, p(req.params.id)) });
});
communityBotRouter.patch(`${B}/settings`, requireAuth, writeRateLimit('general'), async (req, res) => {
  res.json({ data: await communityBotAdminService.updateSettings(req.userId!, p(req.params.id), patchSettingsBody.parse(body(req))) });
});

communityBotRouter.get(`${B}/qa`, requireAuth, async (req, res) => {
  res.json(await communityBotAdminService.listQa(req.userId!, p(req.params.id), qaQuery.parse(req.query)));
});
communityBotRouter.post(`${B}/qa`, requireAuth, writeRateLimit('general'), async (req, res) => {
  res.status(201).json({ data: await communityBotAdminService.createQa(req.userId!, p(req.params.id), qaBody.parse(body(req))) });
});
communityBotRouter.patch(`${B}/qa/:qid`, requireAuth, writeRateLimit('general'), async (req, res) => {
  res.json({ data: await communityBotAdminService.updateQa(req.userId!, p(req.params.id), p(req.params.qid), patchQaBody.parse(body(req))) });
});
communityBotRouter.delete(`${B}/qa/:qid`, requireAuth, writeRateLimit('general'), async (req, res) => {
  await communityBotAdminService.deleteQa(req.userId!, p(req.params.id), p(req.params.qid));
  res.status(204).end();
});

communityBotRouter.get(`${B}/docs`, requireAuth, async (req, res) => {
  res.json({ data: await communityBotAdminService.listDocuments(req.userId!, p(req.params.id)) });
});
communityBotRouter.get(`${B}/docs/:did`, requireAuth, async (req, res) => {
  res.json({ data: await communityBotAdminService.getDocument(req.userId!, p(req.params.id), p(req.params.did)) });
});
communityBotRouter.post(`${B}/docs`, requireAuth, writeRateLimit('general'), async (req, res) => {
  res.status(201).json({ data: await communityBotAdminService.createDocument(req.userId!, p(req.params.id), documentBody.parse(body(req))) });
});
communityBotRouter.patch(`${B}/docs/:did`, requireAuth, writeRateLimit('general'), async (req, res) => {
  res.json({ data: await communityBotAdminService.updateDocument(req.userId!, p(req.params.id), p(req.params.did), patchDocumentBody.parse(body(req))) });
});

communityBotRouter.get(`${B}/conversations`, requireAuth, async (req, res) => {
  res.json(await communityBotAdminService.listConversations(req.userId!, p(req.params.id), conversationsQuery.parse(req.query)));
});
communityBotRouter.get(`${B}/conversations/:cid/detail`, requireAuth, async (req, res) => {
  res.json({ data: await communityBotAdminService.conversationDetail(req.userId!, p(req.params.id), p(req.params.cid)) });
});
