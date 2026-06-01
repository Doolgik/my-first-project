import { Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { AuthRequest } from '../middleware/auth.js';

export const uploadAvatar = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!req.file) throw ApiError.badRequest('No file uploaded');

  // Store as a data URL so the backend stays stateless (serverless-friendly).
  const base64 = req.file.buffer.toString('base64');
  const avatarUrl = `data:${req.file.mimetype};base64,${base64}`;

  const user = await prisma.user.update({
    where: { id: req.userId },
    data: { avatarUrl },
    select: {
      id: true,
      username: true,
      email: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
    },
  });
  res.json({ user });
});
