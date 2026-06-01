import { Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { sendMessageSchema, editMessageSchema } from '../utils/validation.js';
import { ApiError, asyncHandler } from '../utils/errors.js';
import { AuthRequest } from '../middleware/auth.js';
import { ConversationType, ParticipantRole } from '@prisma/client';
import {
  listConversationsForUser,
  assertParticipant,
  findOrCreateDirectConversation,
  getParticipantIds,
  getParticipantRole,
  getConversation,
  userPublicSelect,
} from './conversation.service.js';
import { createMessage, markConversationRead } from './message.service.js';
import { triggerToUsers } from '../lib/realtime.js';

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

  const convo = await getConversation(conversationId);
  const participants = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    include: { user: { select: userPublicSelect } },
  });
  const isDirect = convo?.type === ConversationType.DIRECT;
  const peer = isDirect ? participants.find((p) => p.userId !== req.userId)?.user ?? null : null;
  const myRole = participants.find((p) => p.userId === req.userId)?.role ?? ParticipantRole.MEMBER;

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
    peer,
    conversation: convo
      ? {
          id: convo.id,
          type: convo.type,
          title: isDirect ? peer?.displayName ?? 'Unknown' : convo.title,
          description: convo.description,
          avatarUrl: isDirect ? peer?.avatarUrl ?? null : convo.avatarUrl,
          ownerId: convo.ownerId,
          memberCount: participants.length,
          myRole,
        }
      : null,
  });
});

export const postMessage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = sendMessageSchema.parse(req.body);
  if (data.conversationId) {
    const isMember = await assertParticipant(data.conversationId, req.userId!);
    if (!isMember) throw ApiError.forbidden('You are not a participant of this conversation');
    // In channels, only owners/admins may post.
    const convo = await getConversation(data.conversationId);
    if (convo?.type === ConversationType.CHANNEL) {
      const role = await getParticipantRole(data.conversationId, req.userId!);
      if (role !== ParticipantRole.OWNER && role !== ParticipantRole.ADMIN) {
        throw ApiError.forbidden('Only admins can post in this channel');
      }
    }
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
  await triggerToUsers(participants, 'message:edited', {
    id: updated.id,
    conversationId: updated.conversationId,
    content: updated.content,
    editedAt: updated.editedAt,
  });
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
  await triggerToUsers(participants, 'message:deleted', {
    id: updated.id,
    conversationId: updated.conversationId,
  });
  res.status(204).end();
});

export const postTyping = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { conversationId } = req.params;
  const typing = req.body?.typing !== false;
  const isMember = await assertParticipant(conversationId, req.userId!);
  if (!isMember) throw ApiError.forbidden('You are not a participant of this conversation');

  const participants = (await getParticipantIds(conversationId)).filter((id) => id !== req.userId);
  await triggerToUsers(participants, typing ? 'typing:start' : 'typing:stop', {
    conversationId,
    userId: req.userId,
    username: req.username,
  });
  res.status(204).end();
});

export const markRead = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { conversationId } = req.params;
  const isMember = await assertParticipant(conversationId, req.userId!);
  if (!isMember) throw ApiError.forbidden('You are not a participant of this conversation');
  const result = await markConversationRead(conversationId, req.userId!);
  res.json(result);
});
