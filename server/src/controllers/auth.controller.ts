import { Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { registerSchema, loginSchema } from '../utils/validation.js';
import {
  signAccessToken,
  generateRefreshToken,
  refreshTokenExpiry,
} from '../utils/jwt.js';
import { ApiError, asyncHandler } from '../utils/errors.js';
import { AuthRequest } from '../middleware/auth.js';
import { env, isProd } from '../config/env.js';

const REFRESH_COOKIE = 'refresh_token';

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: env.refreshTokenTtlDays * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function publicUser(user: {
  id: string;
  username: string;
  email: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
}) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
  };
}

async function issueTokens(res: Response, user: { id: string; username: string }) {
  const accessToken = signAccessToken({ sub: user.id, username: user.username });
  const refreshToken = generateRefreshToken();
  await prisma.refreshToken.create({
    data: { token: refreshToken, userId: user.id, expiresAt: refreshTokenExpiry() },
  });
  setRefreshCookie(res, refreshToken);
  return accessToken;
}

export const register = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = registerSchema.parse(req.body);

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: data.email.toLowerCase() }, { username: data.username }] },
  });
  if (existing) {
    throw ApiError.conflict('A user with that email or username already exists');
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await prisma.user.create({
    data: {
      username: data.username,
      email: data.email.toLowerCase(),
      passwordHash,
      displayName: data.displayName,
    },
  });

  const accessToken = await issueTokens(res, user);
  res.status(201).json({ user: publicUser(user), accessToken });
});

export const login = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = loginSchema.parse(req.body);
  const identifier = data.emailOrUsername.toLowerCase();

  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { username: data.emailOrUsername }] },
  });
  if (!user) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  const valid = await bcrypt.compare(data.password, user.passwordHash);
  if (!valid) {
    throw ApiError.unauthorized('Invalid credentials');
  }

  const accessToken = await issueTokens(res, user);
  res.json({ user: publicUser(user), accessToken });
});

export const refresh = asyncHandler(async (req: AuthRequest, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) {
    throw ApiError.unauthorized('Missing refresh token');
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!stored || stored.expiresAt < new Date()) {
    if (stored) {
      await prisma.refreshToken.delete({ where: { id: stored.id } }).catch(() => {});
    }
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  // Rotate: delete old, issue new.
  await prisma.refreshToken.delete({ where: { id: stored.id } });
  const accessToken = await issueTokens(res, stored.user);
  res.json({ user: publicUser(stored.user), accessToken });
});

export const logout = asyncHandler(async (req: AuthRequest, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) {
    await prisma.refreshToken.deleteMany({ where: { token } });
  }
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
  res.status(204).end();
});

export const me = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) throw ApiError.notFound('User not found');
  res.json({ user: publicUser(user) });
});
