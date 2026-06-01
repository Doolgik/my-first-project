import { Server, Socket } from 'socket.io';
import type { Server as HttpServer } from 'http';
import { verifyAccessToken } from '../utils/jwt.js';
import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import {
  setIo,
  addUserSocket,
  removeUserSocket,
  getOnlineUserIds,
  userRoom,
} from './registry.js';
import { createMessage, markConversationRead } from '../controllers/message.service.js';
import { getParticipantIds, assertParticipant } from '../controllers/conversation.service.js';

interface AuthedSocket extends Socket {
  userId?: string;
  username?: string;
}

export function initSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: env.clientOrigin.split(',').map((s) => s.trim()),
      credentials: true,
    },
  });
  setIo(io);

  // Authenticate every socket connection via JWT access token.
  io.use((socket: AuthedSocket, next) => {
    const token =
      (socket.handshake.auth?.token as string | undefined) ||
      (socket.handshake.headers.authorization?.replace('Bearer ', ''));
    if (!token) return next(new Error('Authentication required'));
    try {
      const payload = verifyAccessToken(token);
      socket.userId = payload.sub;
      socket.username = payload.username;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket: AuthedSocket) => {
    const userId = socket.userId!;
    socket.join(userRoom(userId));

    const becameOnline = addUserSocket(userId, socket.id);
    if (becameOnline) {
      await prisma.user.update({ where: { id: userId }, data: { isOnline: true } }).catch(() => {});
      socket.broadcast.emit('presence:update', { userId, isOnline: true });
    }

    // Send the current online roster to the freshly connected client.
    socket.emit('presence:list', { online: getOnlineUserIds() });

    // --- Send a message in real time ---
    socket.on('message:send', async (data: { conversationId?: string; recipientId?: string; content: string }, ack?: (res: any) => void) => {
      try {
        const content = (data?.content ?? '').trim();
        if (!content || content.length > 4000) {
          ack?.({ error: 'Invalid message content' });
          return;
        }
        if (data.conversationId) {
          const member = await assertParticipant(data.conversationId, userId);
          if (!member) {
            ack?.({ error: 'Not a participant' });
            return;
          }
        }
        const message = await createMessage({
          senderId: userId,
          content,
          conversationId: data.conversationId,
          recipientId: data.recipientId,
        });
        ack?.({ message });
      } catch (err) {
        ack?.({ error: (err as Error).message });
      }
    });

    // --- Typing indicator ---
    socket.on('typing:start', async (data: { conversationId: string }) => {
      if (!data?.conversationId) return;
      const participants = await getParticipantIds(data.conversationId);
      for (const uid of participants) {
        if (uid === userId) continue;
        io.to(userRoom(uid)).emit('typing:start', {
          conversationId: data.conversationId,
          userId,
          username: socket.username,
        });
      }
    });

    socket.on('typing:stop', async (data: { conversationId: string }) => {
      if (!data?.conversationId) return;
      const participants = await getParticipantIds(data.conversationId);
      for (const uid of participants) {
        if (uid === userId) continue;
        io.to(userRoom(uid)).emit('typing:stop', { conversationId: data.conversationId, userId });
      }
    });

    // --- Read receipts ---
    socket.on('message:read', async (data: { conversationId: string }) => {
      if (!data?.conversationId) return;
      const member = await assertParticipant(data.conversationId, userId);
      if (!member) return;
      await markConversationRead(data.conversationId, userId);
    });

    socket.on('disconnect', async () => {
      const nowOffline = removeUserSocket(userId, socket.id);
      if (nowOffline) {
        await prisma.user
          .update({ where: { id: userId }, data: { isOnline: false, lastSeen: new Date() } })
          .catch(() => {});
        socket.broadcast.emit('presence:update', { userId, isOnline: false, lastSeen: new Date() });
      }
    });
  });

  return io;
}
