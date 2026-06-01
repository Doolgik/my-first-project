import { prisma } from '../lib/prisma.js';
import { getIo, userRoom } from '../socket/registry.js';
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

  // Broadcast to every participant's personal room.
  const participants = await getParticipantIds(conversationId);
  const io = getIo();
  for (const uid of participants) {
    io.to(userRoom(uid)).emit('message:new', payload);
  }

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
  const io = getIo();
  for (const uid of participants) {
    io.to(userRoom(uid)).emit('message:read', {
      conversationId,
      readerId: userId,
      messageIds: readMessageIds,
      readAt: new Date(),
    });
  }

  return { readMessageIds };
}
