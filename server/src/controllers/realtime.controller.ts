import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { pusher, PRESENCE_CHANNEL, userChannel } from '../lib/realtime.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { AuthRequest } from '../middleware/auth.js';

/**
 * Pusher channel authorization endpoint. The client hits this (with its JWT)
 * before subscribing to private/presence channels. We only authorize a user
 * for their own private channel and the shared presence roster.
 */
export const authorizeChannel = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!pusher) throw ApiError.badRequest('Realtime is not configured');

  const socketId = req.body.socket_id as string;
  const channel = req.body.channel_name as string;
  if (!socketId || !channel) throw ApiError.badRequest('socket_id and channel_name are required');

  // Private per-user channel: only the owner may subscribe.
  if (channel.startsWith('private-user-')) {
    if (channel !== userChannel(req.userId!)) throw ApiError.forbidden('Cannot subscribe to another user channel');
    const auth = pusher.authorizeChannel(socketId, channel);
    return res.send(auth);
  }

  // Shared presence channel: attach this user's public info.
  if (channel === PRESENCE_CHANNEL) {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) throw ApiError.unauthorized();
    await prisma.user.update({ where: { id: user.id }, data: { isOnline: true, lastSeen: new Date() } }).catch(() => {});
    const auth = pusher.authorizeChannel(socketId, channel, {
      user_id: user.id,
      user_info: { username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl },
    });
    return res.send(auth);
  }

  throw ApiError.forbidden('Channel not allowed');
});

interface PusherWebhookEvent {
  name: string;
  channel: string;
  user_id?: string;
}

/**
 * Pusher/soketi presence webhook. Keeps the persisted online status and
 * last-seen timestamp accurate as users join/leave the presence channel.
 * The raw request body is verified against the app secret (HMAC-SHA256).
 */
export const presenceWebhook = asyncHandler(async (req: Request, res: Response) => {
  const secret = process.env.PUSHER_SECRET;
  const raw = req.body as Buffer; // express.raw provides a Buffer
  if (!secret || !pusher || !Buffer.isBuffer(raw)) return res.status(200).end();

  const signature = req.header('x-pusher-signature');
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  if (!signature || signature !== expected) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  let payload: { events?: PusherWebhookEvent[] };
  try {
    payload = JSON.parse(raw.toString('utf8'));
  } catch {
    return res.status(400).end();
  }

  for (const event of payload.events ?? []) {
    if (event.channel !== PRESENCE_CHANNEL || !event.user_id) continue;
    if (event.name === 'member_added') {
      await prisma.user.update({ where: { id: event.user_id }, data: { isOnline: true } }).catch(() => {});
    } else if (event.name === 'member_removed') {
      await prisma.user
        .update({ where: { id: event.user_id }, data: { isOnline: false, lastSeen: new Date() } })
        .catch(() => {});
    }
  }
  res.status(200).json({ ok: true });
});
