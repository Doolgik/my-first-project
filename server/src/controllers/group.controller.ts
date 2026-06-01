import { Response } from 'express';
import { ConversationType, ParticipantRole } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { AuthRequest } from '../middleware/auth.js';
import { createGroupSchema, updateConversationSchema, addMemberSchema } from '../utils/validation.js';
import {
  createGroupConversation,
  getParticipantRole,
  getParticipantIds,
  listMembers,
  getConversation,
  userPublicSelect,
} from './conversation.service.js';
import { triggerToUsers } from '../lib/realtime.js';

function isManager(role: ParticipantRole | null) {
  return role === ParticipantRole.OWNER || role === ParticipantRole.ADMIN;
}

export const createGroup = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = createGroupSchema.parse(req.body);
  const convo = await createGroupConversation(
    req.userId!,
    data.title,
    data.memberIds,
    data.type as ConversationType,
    data.avatarUrl ?? null
  );

  // Notify every member so the new conversation appears in their list instantly.
  const participantIds = convo.participants.map((p) => p.userId);
  await triggerToUsers(participantIds, 'conversation:new', { conversationId: convo.id });

  res.status(201).json({ conversationId: convo.id });
});

export const getMembers = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { conversationId } = req.params;
  const role = await getParticipantRole(conversationId, req.userId!);
  if (!role) throw ApiError.forbidden('You are not a participant of this conversation');
  const members = await listMembers(conversationId);
  res.json({ members });
});

export const updateConversation = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { conversationId } = req.params;
  const data = updateConversationSchema.parse(req.body);
  const convo = await getConversation(conversationId);
  if (!convo) throw ApiError.notFound('Conversation not found');
  if (convo.type === ConversationType.DIRECT) throw ApiError.badRequest('Cannot edit a direct chat');
  const role = await getParticipantRole(conversationId, req.userId!);
  if (!isManager(role)) throw ApiError.forbidden('Only admins can edit this conversation');

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
    },
  });

  const ids = await getParticipantIds(conversationId);
  await triggerToUsers(ids, 'conversation:updated', {
    conversationId,
    title: updated.title,
    description: updated.description,
    avatarUrl: updated.avatarUrl,
  });
  res.json({ conversation: { id: updated.id, title: updated.title, description: updated.description, avatarUrl: updated.avatarUrl } });
});

export const addMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { conversationId } = req.params;
  const { userId } = addMemberSchema.parse(req.body);
  const convo = await getConversation(conversationId);
  if (!convo || convo.type === ConversationType.DIRECT) throw ApiError.badRequest('Not a group conversation');
  const role = await getParticipantRole(conversationId, req.userId!);
  if (!isManager(role)) throw ApiError.forbidden('Only admins can add members');

  const target = await prisma.user.findUnique({ where: { id: userId }, select: userPublicSelect });
  if (!target) throw ApiError.notFound('User not found');

  await prisma.conversationParticipant.upsert({
    where: { conversationId_userId: { conversationId, userId } },
    update: {},
    create: { conversationId, userId, role: ParticipantRole.MEMBER },
  });

  const ids = await getParticipantIds(conversationId);
  await triggerToUsers(ids, 'conversation:members', { conversationId });
  await triggerToUsers([userId], 'conversation:new', { conversationId });
  res.status(201).json({ member: { ...target, role: ParticipantRole.MEMBER } });
});

export const removeMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { conversationId, userId } = req.params;
  const convo = await getConversation(conversationId);
  if (!convo || convo.type === ConversationType.DIRECT) throw ApiError.badRequest('Not a group conversation');
  const role = await getParticipantRole(conversationId, req.userId!);

  // A user can always remove themselves (leave); managers can remove others.
  const isSelf = userId === req.userId;
  if (!isSelf && !isManager(role)) throw ApiError.forbidden('Only admins can remove members');
  if (userId === convo.ownerId && isSelf) throw ApiError.badRequest('The owner cannot leave; delete the group instead');

  const idsBefore = await getParticipantIds(conversationId);
  await prisma.conversationParticipant.deleteMany({ where: { conversationId, userId } });
  await triggerToUsers(idsBefore, 'conversation:members', { conversationId });
  await triggerToUsers([userId], 'conversation:removed', { conversationId });
  res.status(204).end();
});

export const promoteMember = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { conversationId, userId } = req.params;
  const convo = await getConversation(conversationId);
  if (!convo || convo.type === ConversationType.DIRECT) throw ApiError.badRequest('Not a group conversation');
  const role = await getParticipantRole(conversationId, req.userId!);
  if (role !== ParticipantRole.OWNER) throw ApiError.forbidden('Only the owner can change admins');

  const makeAdmin = req.body?.admin !== false;
  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { role: makeAdmin ? ParticipantRole.ADMIN : ParticipantRole.MEMBER },
  });
  const ids = await getParticipantIds(conversationId);
  await triggerToUsers(ids, 'conversation:members', { conversationId });
  res.json({ ok: true });
});
