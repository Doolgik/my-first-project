import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { env, isProd } from './config/env.js';
import apiRouter from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/error.js';
import { initSocket } from './socket/index.js';
import { prisma } from './lib/prisma.js';

const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(
  cors({
    origin: env.clientOrigin.split(',').map((s) => s.trim()),
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
if (!isProd) app.use(morgan('dev'));

// Serve uploaded avatars.
const uploadDir = path.resolve(process.cwd(), env.uploadDir);
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
app.use('/uploads', express.static(uploadDir));

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/api', apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

// Initialize realtime layer.
initSocket(server);

async function start() {
  try {
    await prisma.$connect();
    server.listen(env.port, () => {
      console.log(`🚀 Server listening on http://localhost:${env.port}`);
      console.log(`   Environment: ${env.nodeEnv}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();

const shutdown = async () => {
  console.log('\nShutting down...');
  await prisma.$disconnect();
  server.close(() => process.exit(0));
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
