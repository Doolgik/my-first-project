import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { env, isProd } from './config/env.js';
import apiRouter from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';
import { presenceWebhook } from './controllers/realtime.controller.js';

/**
 * The Express application, with no `listen` call, so it can be used both by the
 * local HTTP server (src/index.ts) and by the Vercel serverless function
 * (api/index.ts).
 */
export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: env.clientOrigin.split(',').map((s) => s.trim()),
      credentials: true,
    })
  );
  // Larger limit because avatars are returned as data URLs in JSON payloads.
  app.use(express.json({ limit: '6mb' }));
  app.use(cookieParser());
  if (!isProd) app.use(morgan('dev'));

  // Presence webhook needs the raw body for signature verification — register it
  // here, after json() but with its own raw parser scoped to the route.
  app.post('/api/realtime/webhook', express.raw({ type: '*/*' }), presenceWebhook);

  app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
