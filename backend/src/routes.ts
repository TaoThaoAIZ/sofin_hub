import { Router } from 'express';
import { communityAlias } from './middlewares/community-alias.js';
import { globalRateLimit } from './middlewares/rate-limit.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { mailRouter } from './modules/mail/mail.routes.js';
import { supportRouter } from './modules/support/support.routes.js';
import { ticketsRouter } from './modules/support/tickets.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { classroomRouter } from './modules/classroom/classroom.routes.js';
import { communitiesRouter } from './modules/communities/communities.routes.js';
import { communityRouter } from './modules/community/community.routes.js';
import { catalogRouter } from './modules/catalog/catalog.routes.js';
import { eventsRouter } from './modules/events/events.routes.js';
import { metaRouter } from './modules/meta/meta.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { paymentsRouter } from './modules/payments/payments.routes.js';
import { searchRouter } from './modules/search/search.routes.js';
import { postsRouter } from './modules/posts/posts.routes.js';
import { messagesRouter } from './modules/messages/messages.routes.js';
import { uploadsRouter } from './modules/uploads/uploads.routes.js';
import { adminRouter } from './modules/admin/admin.routes.js';
import { adminBatch2Router } from './modules/admin/admin-b2.routes.js';
import { adminBatch3Router } from './modules/admin/admin-b3.routes.js';
import { maintenanceGuard, platformRouter } from './modules/platform/platform.routes.js';
import { moderationRouter } from './modules/moderation/moderation.routes.js';

export const apiRouter = Router();

apiRouter.use(globalRateLimit); // giới hạn toàn cục theo IP (tắt khi test; xem middlewares/rate-limit.ts)
apiRouter.use(communityAlias); // /communities/:id/* ≡ /courses/:id/*, courseId ≡ communityId (tách Community/Course)
apiRouter.use(maintenanceGuard);
apiRouter.use('/', platformRouter);

apiRouter.use('/auth', authRouter);
apiRouter.use('/', mailRouter);
apiRouter.use('/', usersRouter);
apiRouter.use('/', supportRouter);
apiRouter.use('/', ticketsRouter);
apiRouter.use('/courses', catalogRouter);
apiRouter.use('/', metaRouter);
apiRouter.use('/', postsRouter);
apiRouter.use('/', moderationRouter);
apiRouter.use('/', classroomRouter);
apiRouter.use('/', eventsRouter);
apiRouter.use('/', communityRouter);
apiRouter.use('/', paymentsRouter);
apiRouter.use('/', notificationsRouter);
apiRouter.use('/', searchRouter);
apiRouter.use('/', uploadsRouter);
apiRouter.use('/', messagesRouter);
apiRouter.use('/', communitiesRouter);
// Admin đợt 1 (dashboard/communities/users/moderation/audit). Đăng ký cuối: route /admin/* cũ ở module khác khớp trước.
apiRouter.use('/', adminRouter);
// Admin đợt 2 (content / payments / discovery).
apiRouter.use('/', adminBatch2Router);
// Admin đợt 3 (analytics / support / system).
apiRouter.use('/', adminBatch3Router);
