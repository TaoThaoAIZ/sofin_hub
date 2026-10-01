import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env, isProd } from './config/env.js';
import { prisma } from './db/prisma.js';
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js';
import { apiRouter } from './routes.js';

export function createApp() {
  const app = express();

  // Phía sau ALB/CloudFront trên AWS: tin header X-Forwarded-* để lấy đúng IP/protocol.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
  app.use(compression());
  // `verify` giữ nguyên bytes gốc (rawBody) CHỈ cho webhook thanh toán: chữ ký HMAC phải tính trên raw body, không phải JSON đã parse.
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        const r = req as typeof req & { originalUrl?: string; rawBody?: Buffer };
        if (r.originalUrl?.startsWith('/api/payments/webhook')) r.rawBody = Buffer.from(buf);
      },
    }),
  );
  app.use(cookieParser());
  if (env.NODE_ENV !== 'test') app.use(morgan(isProd ? 'combined' : 'dev'));

  // Health check cho ALB / ECS / Docker HEALTHCHECK
  app.get('/health', async (_req, res) => {
    try {
      await prisma.$queryRaw`SELECT 1`; // DB chết thì báo 503 để ALB/ECS loại instance
      res.json({ status: 'ok', uptime: process.uptime() });
    } catch (err) {
      // Ghi lý do vào log (Render/CloudWatch) — response ra ngoài vẫn không lộ chi tiết.
      console.error('[health] kiểm tra DB thất bại:', err);
      res.status(503).json({ status: 'db_unavailable' });
    }
  });

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
