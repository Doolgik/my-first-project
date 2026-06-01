import http from 'http';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';
import { realtimeEnabled } from './lib/realtime.js';

const app = createApp();
const server = http.createServer(app);

async function start() {
  try {
    await prisma.$connect();
    server.listen(env.port, () => {
      console.log(`🚀 Server listening on http://localhost:${env.port}`);
      console.log(`   Environment: ${env.nodeEnv}`);
      console.log(`   Realtime (Pusher): ${realtimeEnabled() ? 'enabled' : 'disabled (set PUSHER_* env vars)'}`);
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
