import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../utils/errors.js';
import { AuthRequest } from '../middleware/auth.js';

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

export const subscribe = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = subscribeSchema.parse(req.body);
  await prisma.pushSubscription.upsert({
    where: { endpoint: data.endpoint },
    update: { userId: req.userId!, p256dh: data.keys.p256dh, auth: data.keys.auth },
    create: { userId: req.userId!, endpoint: data.endpoint, p256dh: data.keys.p256dh, auth: data.keys.auth },
  });
  res.status(201).json({ ok: true });
});

export const unsubscribe = asyncHandler(async (req: AuthRequest, res: Response) => {
  const endpoint = req.body?.endpoint as string | undefined;
  if (endpoint) await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.userId } });
  res.status(204).end();
});
