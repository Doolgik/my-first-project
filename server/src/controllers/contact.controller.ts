import { Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { AuthRequest } from '../middleware/auth.js';
import { addContactSchema } from '../utils/validation.js';
import { userPublicSelect } from './conversation.service.js';

export const listContacts = asyncHandler(async (req: AuthRequest, res: Response) => {
  const contacts = await prisma.contact.findMany({
    where: { ownerId: req.userId },
    include: { contact: { select: userPublicSelect } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ contacts: contacts.map((c) => c.contact) });
});

export const addContact = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { contactId } = addContactSchema.parse(req.body);
  if (contactId === req.userId) throw ApiError.badRequest('You cannot add yourself');

  const target = await prisma.user.findUnique({ where: { id: contactId }, select: userPublicSelect });
  if (!target) throw ApiError.notFound('User not found');

  await prisma.contact.upsert({
    where: { ownerId_contactId: { ownerId: req.userId!, contactId } },
    update: {},
    create: { ownerId: req.userId!, contactId },
  });
  res.status(201).json({ contact: target });
});

export const removeContact = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { contactId } = req.params;
  await prisma.contact.deleteMany({ where: { ownerId: req.userId, contactId } });
  res.status(204).end();
});
