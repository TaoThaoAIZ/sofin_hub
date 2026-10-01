import { Router, type RequestHandler } from 'express';
import { optionalAuth } from '../../middlewares/auth.js';
import { publicFlags } from '../admin/admin-system.service.js';
import { cfg } from '../settings/settings.service.js';

export const platformRouter = Router();

/** Cờ tính năng + trạng thái bảo trì cho client. Đăng nhập tuỳ chọn (rollout theo % cần userId); không cache để đổi cờ có hiệu lực ngay. */
platformRouter.get('/feature-flags', optionalAuth, async (req, res) => {
  const c = cfg();
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    data: {
      flags: await publicFlags(req.userId),
      maintenance: c.security.maintenanceMode,
      platform: { name: c.platform.name, supportEmail: c.platform.supportEmail, defaultLanguage: c.platform.defaultLanguage },
    },
  });
});

/** Chế độ bảo trì: mọi API công khai trả 503 trừ admin, đăng nhập, cờ tính năng, webhook thanh toán và /dev. */
const EXEMPT = ['/admin', '/auth', '/feature-flags', '/dev', '/payments/webhook'];
export const maintenanceGuard: RequestHandler = (req, res, next) => {
  if (!cfg().security.maintenanceMode) return next();
  const path = req.path;
  if (EXEMPT.some((p) => path === p || path.startsWith(`${p}/`))) return next();
  res.status(503).json({ error: { code: 'MAINTENANCE', message: 'Hệ thống đang bảo trì, vui lòng quay lại sau.' } });
};
