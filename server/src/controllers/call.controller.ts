import { Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler } from '../utils/errors.js';
import { AuthRequest } from '../middleware/auth.js';
import { callSignalSchema } from '../utils/validation.js';
import { triggerToUser } from '../lib/realtime.js';
import { userPublicSelect } from './conversation.service.js';

/**
 * WebRTC signaling relay. The browsers exchange SDP offers/answers and ICE
 * candidates through the backend, which forwards each signal to the target
 * user's private realtime channel. The backend never touches media.
 */
export const sendSignal = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = callSignalSchema.parse(req.body);

  // Include the caller's public profile on the initial offer so the callee can
  // render an incoming-call screen without an extra request.
  let from: unknown = { id: req.userId, username: req.username };
  if (data.type === 'offer') {
    from = await prisma.user.findUnique({ where: { id: req.userId }, select: userPublicSelect });
  }

  await triggerToUser(data.toUserId, 'call:signal', {
    type: data.type,
    callId: data.callId,
    media: data.media,
    fromUserId: req.userId,
    from,
    payload: data.payload ?? null,
  });

  res.status(202).json({ ok: true });
});
