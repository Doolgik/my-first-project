import { ConversationType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { triggerToUsers } from '../lib/realtime.js';
import { sendPushToUsers } from '../lib/push.js';
import { findOrCreateDirectConversation, getParticipantIds } from './conversation.service.js';

export interface CreateMessageArgs {
  senderId: string;
  content: string;
  conversationId?: string;
  recipientId?: string;
}

const senderSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
};

export async function createMessage(args: CreateMessageArgs) {
  let conversationId = args.conversationId;

  if (!conversationId) {
    if (!args.recipientId) throw new Error('recipientId required');
    const convo = await findOrCreateDirectConversation(args.senderId, args.recipientId);
    conversationId = convo.id;
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: args.senderId,
      content: args.content,
    },
    include: { sender: { select: senderSelect } },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  const payload = {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    sender: message.sender,
    content: message.content,
    createdAt: message.createdAt,
    editedAt: message.editedAt,
    deleted: false,
    reads: [] as { userId: string; readAt: Date }[],
  };

  // Broadcast to every participant's private channel.
  const participants = await getParticipantIds(conversationId);
  await triggerToUsers(participants, 'message:new', payload);

  // Web push to everyone except the sender (delivered even when the app is closed).
  const convo = await prisma.conversation.findUnique({ where: { id: conversationId } });
  const isGroup = convo && convo.type !== ConversationType.DIRECT;
  const preview = args.content.length > 120 ? args.content.slice(0, 120) + '…' : args.content;
  sendPushToUsers(
    participants,
    {
      title: isGroup ? convo!.title ?? 'Group' : message.sender.displayName,
      body: isGroup ? `${message.sender.displayName}: ${preview}` : preview,
      tag: `conv-${conversationId}`,
      conversationId,
      type: 'message',
    },
    args.senderId
  ).catch(() => {});

  return payload;
}

export async function markConversationRead(conversationId: string, userId: string) {
  const unread = await prisma.message.findMany({
    where: {
      conversationId,
      senderId: { not: userId },
      reads: { none: { userId } },
    },
    select: { id: true },
  });

  if (unread.length === 0) return { readMessageIds: [] as string[] };

  await prisma.messageRead.createMany({
    data: unread.map((m) => ({ messageId: m.id, userId })),
    skipDuplicates: true,
  });

  const readMessageIds = unread.map((m) => m.id);

  // Notify other participants that this user read messages.
  const participants = await getParticipantIds(conversationId);
  await triggerToUsers(participants, 'message:read', {
    conversationId,
    readerId: userId,
    messageIds: readMessageIds,
    readAt: new Date(),
  });

  return { readMessageIds };
}
