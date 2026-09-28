import { Router } from 'express';
import { authRouter } from './modules/auth/auth.routes.js';
import { coursesRouter } from './modules/courses/courses.routes.js';
import { metaRouter } from './modules/meta/meta.routes.js';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/courses', coursesRouter);
apiRouter.use('/', metaRouter);
