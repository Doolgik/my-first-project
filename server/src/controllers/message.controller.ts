import { Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { sendMessageSchema, editMessageSchema } from '../utils/validation.js';
import { ApiError, asyncHandler } from '../utils/errors.js';
import { AuthRequest } from '../middleware/auth.js';
import {
  listConversationsForUser,
  assertParticipant,
  findOrCreateDirectConversation,
  getParticipantIds,
  userPublicSelect,
} from './conversation.service.js';
import { createMessage, markConversationRead } from './message.service.js';
import { getIo, isOnline, userRoom } from '../socket/registry.js';

export const getConversations = asyncHandler(async (req: AuthRequest, res: Response) => {
  const conversations = await listConversationsForUser(req.userId!);
  res.json({ conversations });
});

export const startConversation = asyncHandler(async (req: AuthRequest, res: Response) => {
  const recipientId = req.body.recipientId as string;
  if (!recipientId) throw ApiError.badRequest('recipientId is required');
  if (recipientId === req.userId) throw ApiError.badRequest('Cannot message yourself');

  const recipient = await prisma.user.findUnique({ where: { id: recipientId } });
  if (!recipient) throw ApiError.notFound('Recipient not found');

  const convo = await findOrCreateDirectConversation(req.userId!, recipientId);
  res.status(201).json({ conversationId: convo.id });
});

export const getMessages = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { conversationId } = req.params;
  const isMember = await assertParticipant(conversationId, req.userId!);
  if (!isMember) throw ApiError.forbidden('You are not a participant of this conversation');

  const limit = Math.min(parseInt((req.query.limit as string) ?? '50', 10), 100);
  const before = req.query.before as string | undefined;

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    include: {
      sender: { select: { id: true, username: true, displayName: true, avatarUrl: true } },
      reads: { select: { userId: true, readAt: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  // Other participant info for the conversation header.
  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    include: { user: { select: userPublicSelect } },
  });
  const peer = participants.find((p) => p.userId !== req.userId)?.user ?? null;

  res.json({
    messages: messages
      .reverse()
      .map((m) => ({
        id: m.id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        sender: m.sender,
        content: m.deletedAt ? null : m.content,
        deleted: !!m.deletedAt,
        createdAt: m.createdAt,
        editedAt: m.editedAt,
        reads: m.reads,
      })),
    peer: peer ? { ...peer, isOnline: isOnline(peer.id) || peer.isOnline } : null,
  });
});

export const postMessage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = sendMessageSchema.parse(req.body);
  if (data.conversationId) {
    const isMember = await assertParticipant(data.conversationId, req.userId!);
    if (!isMember) throw ApiError.forbidden('You are not a participant of this conversation');
  }
  const message = await createMessage({
    senderId: req.userId!,
    content: data.content,
    conversationId: data.conversationId,
    recipientId: data.recipientId,
  });
  res.status(201).json({ message });
});

export const editMessage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { content } = editMessageSchema.parse(req.body);

  const existing = await prisma.message.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw ApiError.notFound('Message not found');
  if (existing.senderId !== req.userId) throw ApiError.forbidden('You can only edit your own messages');

  const updated = await prisma.message.update({
    where: { id },
    data: { content, editedAt: new Date() },
  });

  const participants = await getParticipantIds(updated.conversationId);
  const io = getIo();
  for (const uid of participants) {
    io.to(userRoom(uid)).emit('message:edited', {
      id: updated.id,
      conversationId: updated.conversationId,
      content: updated.content,
      editedAt: updated.editedAt,
    });
  }
  res.json({ message: { id: updated.id, content: updated.content, editedAt: updated.editedAt } });
});

export const deleteMessage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const existing = await prisma.message.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) throw ApiError.notFound('Message not found');
  if (existing.senderId !== req.userId) throw ApiError.forbidden('You can only delete your own messages');

  const updated = await prisma.message.update({
    where: { id },
    data: { deletedAt: new Date(), content: '' },
  });

  const participants = await getParticipantIds(updated.conversationId);
  const io = getIo();
  for (const uid of participants) {
    io.to(userRoom(uid)).emit('message:deleted', {
      id: updated.id,
      conversationId: updated.conversationId,
    });
  }
  res.status(204).end();
});

export const markRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { conversationId } = req.params;
  const isMember = await assertParticipant(conversationId, req.userId!);
  if (!isMember) throw ApiError.forbidden('You are not a participant of this conversation');
  const result = await markConversationRead(conversationId, req.userId!);
  res.json(result);
});
