import { Router } from 'express';
import { adminOnly } from '../admin/admin.common.js';
import {
  adminChatbotService as svc,
  approveQaBody,
  conversationsQuery,
  createDocBody,
  createQaBody,
  patchChatbotSettingsBody,
  patchDocBody,
  patchQaBody,
  qaQuery,
} from './admin-chatbot.service.js';
import { chatbotAccountService as account } from './chatbot.account.js';
import { learnFromConversations } from './chatbot.learn.js';

/**
 * Admin > Hỗ trợ > Chatbot. Đường dẫn dưới /admin/support/* => quyền `support.manage` (admin-staff.permissions.ts), không cần khóa quyền mới.
 * Contract: backend/docs/api/chatbot.md.
 */
export const adminChatbotRouter = Router();
const R = adminChatbotRouter;
const B = '/admin/support/chatbot';
const p = (v: string | string[] | undefined) => String(v);
const body = (req: { body?: unknown }) => req.body ?? {};

R.get(`${B}/summary`, ...adminOnly, async (_req, res) => res.json({ data: await svc.summary() }));

R.get(`${B}/qa`, ...adminOnly, async (req, res) => res.json(await svc.listQa(qaQuery.parse(req.query))));
R.post(`${B}/qa`, ...adminOnly, async (req, res) => res.status(201).json({ data: await svc.createQa(req.userId!, createQaBody.parse(body(req))) }));
R.get(`${B}/qa/:id`, ...adminOnly, async (req, res) => res.json({ data: await svc.getQa(p(req.params.id)) }));
R.patch(`${B}/qa/:id`, ...adminOnly, async (req, res) => res.json({ data: await svc.updateQa(req.userId!, p(req.params.id), patchQaBody.parse(body(req))) }));
R.post(`${B}/qa/:id/approve`, ...adminOnly, async (req, res) => res.json({ data: await svc.approveQa(req.userId!, p(req.params.id), approveQaBody.parse(body(req))) }));
R.post(`${B}/qa/:id/reject`, ...adminOnly, async (req, res) => res.json({ data: await svc.rejectQa(req.userId!, p(req.params.id)) }));

R.get(`${B}/documents`, ...adminOnly, async (_req, res) => res.json({ data: await svc.listDocuments() }));
R.post(`${B}/documents`, ...adminOnly, async (req, res) => res.status(201).json({ data: await svc.createDocument(req.userId!, createDocBody.parse(body(req))) }));
R.get(`${B}/documents/:id`, ...adminOnly, async (req, res) => res.json({ data: await svc.getDocument(p(req.params.id)) }));
R.patch(`${B}/documents/:id`, ...adminOnly, async (req, res) => res.json({ data: await svc.updateDocument(req.userId!, p(req.params.id), patchDocBody.parse(body(req))) }));

R.get(`${B}/conversations`, ...adminOnly, async (req, res) => res.json(await svc.listConversations(conversationsQuery.parse(req.query))));
R.get(`${B}/conversations/:id`, ...adminOnly, async (req, res) => res.json({ data: await svc.getConversation(p(req.params.id)) }));

R.get(`${B}/settings`, ...adminOnly, async (_req, res) => res.json({ data: await svc.getSettings() }));
R.patch(`${B}/settings`, ...adminOnly, async (req, res) => res.json({ data: await svc.updateSettings(req.userId!, patchChatbotSettingsBody.parse(body(req))) }));

/** Chạy job học ngay (không chờ lượt mỗi giờ). */
R.post(`${B}/learn`, ...adminOnly, async (_req, res) => res.json({ data: await learnFromConversations() }));

/**
 * Tài khoản ChatGPT của chatbot (đăng nhập Codex bằng mã thiết bị). Đường dẫn /admin/system/chatbot-account không có trong bảng
 * quyền (admin-staff.permissions.ts) => CHỈ Super Admin.
 */
const A = '/admin/system/chatbot-account';
R.get(A, ...adminOnly, (_req, res) => res.json({ data: account.status() }));
R.post(`${A}/login`, ...adminOnly, async (req, res) => res.json({ data: await account.startLogin(req.userId!) }));
R.post(`${A}/login/cancel`, ...adminOnly, (_req, res) => res.json({ data: account.cancelLogin() }));
R.post(`${A}/logout`, ...adminOnly, async (req, res) => res.json({ data: await account.logout(req.userId!) }));

