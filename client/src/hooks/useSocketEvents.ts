import { useEffect } from 'react';
import { connectSocket, disconnectSocket } from '../lib/socket';
import { useChat } from '../store/chat';
import { useAuth } from '../store/auth';
import type { Message } from '../types';

/**
 * Establishes the socket connection for the authenticated session and binds
 * all realtime events (messages, presence, typing, read receipts) to the store.
 */
export function useSocketEvents() {
  const user = useAuth((s) => s.user);
  const chat = useChat();

  useEffect(() => {
    if (!user) return;
    const socket = connectSocket();

    const onNew = (msg: Message) => {
      useChat.getState().upsertMessage(msg);
      // Auto-mark as read if this conversation is open and we are the recipient.
      const active = useChat.getState().activeId;
      if (active === msg.conversationId && msg.senderId !== user.id) {
        socket.emit('message:read', { conversationId: msg.conversationId });
      }
    };
    const onEdited = (d: { id: string; conversationId: string; content: string; editedAt: string }) =>
      useChat.getState().editMessageLocal(d.id, d.conversationId, d.content, d.editedAt);
    const onDeleted = (d: { id: string; conversationId: string }) =>
      useChat.getState().deleteMessageLocal(d.id, d.conversationId);
    const onRead = (d: { conversationId: string; readerId: string; messageIds: string[]; readAt: string }) =>
      useChat.getState().markReadLocal(d.conversationId, d.readerId, d.messageIds, d.readAt);
    const onPresence = (d: { userId: string; isOnline: boolean; lastSeen?: string }) =>
      useChat.getState().setPresence(d.userId, d.isOnline, d.lastSeen);
    const onPresenceList = (d: { online: string[] }) => useChat.getState().setOnlineList(d.online);
    const onTypingStart = (d: { conversationId: string; username: string }) =>
      useChat.getState().setTyping(d.conversationId, d.username, true);
    const onTypingStop = (d: { conversationId: string; userId: string }) => {
      // We key typing by username on start; stop clears by matching peer.
      const peers = useChat.getState().peers[d.conversationId];
      if (peers?.id === d.userId) useChat.getState().setTyping(d.conversationId, peers.username, false);
    };

    socket.on('message:new', onNew);
    socket.on('message:edited', onEdited);
    socket.on('message:deleted', onDeleted);
    socket.on('message:read', onRead);
    socket.on('presence:update', onPresence);
    socket.on('presence:list', onPresenceList);
    socket.on('typing:start', onTypingStart);
    socket.on('typing:stop', onTypingStop);

    return () => {
      socket.off('message:new', onNew);
      socket.off('message:edited', onEdited);
      socket.off('message:deleted', onDeleted);
      socket.off('message:read', onRead);
      socket.off('presence:update', onPresence);
      socket.off('presence:list', onPresenceList);
      socket.off('typing:start', onTypingStart);
      socket.off('typing:stop', onTypingStop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    return () => {
      if (!useAuth.getState().user) disconnectSocket();
    };
  }, []);
}
