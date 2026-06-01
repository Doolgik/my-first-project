import { prisma } from '../lib/prisma.js';
import { isOnline } from '../socket/registry.js';

const userPublicSelect = {
  id: true,
  username: true,
  displayName: true,
  avatarUrl: true,
  bio: true,
  isOnline: true,
  lastSeen: true,
};

/** Find an existing 1:1 conversation between two users, or create one. */
export async function findOrCreateDirectConversation(userA: string, userB: string) {
  if (userA === userB) {
    throw new Error('Cannot create a conversation with yourself');
  }

  const existing = await prisma.conversation.findFirst({
    where: {
      AND: [
        { participants: { some: { userId: userA } } },
        { participants: { some: { userId: userB } } },
      ],
    },
    include: { participants: true },
  });

  if (existing && existing.participants.length === 2) {
    return existing;
  }

  return prisma.conversation.create({
    data: {
      participants: {
        create: [{ userId: userA }, { userId: userB }],
      },
    },
    include: { participants: true },
  });
}

/** Returns the list of conversations for a user with last message + unread count. */
export async function listConversationsForUser(userId: string) {
  const conversations = await prisma.conversation.findMany({
    where: { participants: { some: { userId } } },
    include: {
      participants: { include: { user: { select: userPublicSelect } } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: { reads: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const results = await Promise.all(
    conversations.map(async (c) => {
      const other = c.participants.find((p) => p.userId !== userId)?.user ?? null;
      const unreadCount = await prisma.message.count({
        where: {
          conversationId: c.id,
          senderId: { not: userId },
          reads: { none: { userId } },
          deletedAt: null,
        },
      });
      const lastMessage = c.messages[0]
        ? {
            id: c.messages[0].id,
            content: c.messages[0].deletedAt ? null : c.messages[0].content,
            senderId: c.messages[0].senderId,
            createdAt: c.messages[0].createdAt,
            deleted: !!c.messages[0].deletedAt,
          }
        : null;
      return {
        id: c.id,
        peer: other ? { ...other, isOnline: isOnline(other.id) || other.isOnline } : null,
        lastMessage,
        unreadCount,
        updatedAt: c.updatedAt,
      };
    })
  );

  return results;
}

export async function getParticipantIds(conversationId: string): Promise<string[]> {
  const parts = await prisma.conversationParticipant.findMany({
    where: { conversationId },
    select: { userId: true },
  });
  return parts.map((p) => p.userId);
}

export async function assertParticipant(conversationId: string, userId: string) {
  const part = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  return !!part;
}

export { userPublicSelect };
