import { Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { updateProfileSchema } from '../utils/validation.js';
import { ApiError, asyncHandler } from '../utils/errors.js';
import { AuthRequest } from '../middleware/auth.js';
import { userPublicSelect } from './conversation.service.js';
import { isOnline } from '../socket/registry.js';

export const searchUsers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const q = (req.query.q as string | undefined)?.trim() ?? '';
  if (q.length < 1) {
    return res.json({ users: [] });
  }
  const users = await prisma.user.findMany({
    where: {
      AND: [
        { id: { not: req.userId } },
        {
          OR: [
            { username: { contains: q, mode: 'insensitive' } },
            { displayName: { contains: q, mode: 'insensitive' } },
          ],
        },
      ],
    },
    select: userPublicSelect,
    take: 20,
    orderBy: { displayName: 'asc' },
  });
  res.json({ users: users.map((u) => ({ ...u, isOnline: isOnline(u.id) || u.isOnline })) });
});

export const getUser = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: userPublicSelect,
  });
  if (!user) throw ApiError.notFound('User not found');
  res.json({ user: { ...user, isOnline: isOnline(user.id) || user.isOnline } });
});

export const updateProfile = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = updateProfileSchema.parse(req.body);
  const user = await prisma.user.update({
    where: { id: req.userId },
    data: {
      ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
      ...(data.bio !== undefined ? { bio: data.bio } : {}),
    },
    select: { ...userPublicSelect, email: true },
  });
  res.json({ user });
});
