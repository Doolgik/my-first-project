import { useEffect } from 'react';
import { connectPusher, disconnectPusher, PRESENCE_CHANNEL, userChannelName } from '../lib/socket';
import { useChat } from '../store/chat';
import { useAuth } from '../store/auth';
import { api } from '../lib/api';
import type { Message } from '../types';

/**
 * Connects to the realtime broker for the authenticated session and binds all
 * events: messages, presence (presence channel roster), typing and read
 * receipts (delivered on the user's private channel).
 */
export function useSocketEvents() {
  const user = useAuth((s) => s.user);

  useEffect(() => {
    if (!user) return;
    const pusher = connectPusher();

    // --- Presence roster (online users) ---
    const presence = pusher.subscribe(PRESENCE_CHANNEL) as any;
    presence.bind('pusher:subscription_succeeded', (members: any) => {
      const ids: string[] = [];
      members.each((m: any) => ids.push(m.id));
      useChat.getState().setOnlineList(ids);
    });
    presence.bind('pusher:member_added', (m: any) => useChat.getState().setPresence(m.id, true));
    presence.bind('pusher:member_removed', (m: any) =>
      useChat.getState().setPresence(m.id, false, new Date().toISOString())
    );

    // --- Private user channel: messages, typing, read receipts ---
    const channel = pusher.subscribe(userChannelName(user.id));

    const onNew = (msg: Message) => {
      useChat.getState().upsertMessage(msg);
      const active = useChat.getState().activeId;
      if (active === msg.conversationId && msg.senderId !== user.id) {
        api.post(`/conversations/${msg.conversationId}/read`).catch(() => {});
      }
    };
    const onEdited = (d: { id: string; conversationId: string; content: string; editedAt: string }) =>
      useChat.getState().editMessageLocal(d.id, d.conversationId, d.content, d.editedAt);
    const onDeleted = (d: { id: string; conversationId: string }) =>
      useChat.getState().deleteMessageLocal(d.id, d.conversationId);
    const onRead = (d: { conversationId: string; readerId: string; messageIds: string[]; readAt: string }) =>
      useChat.getState().markReadLocal(d.conversationId, d.readerId, d.messageIds, d.readAt);
    const onTypingStart = (d: { conversationId: string; username: string }) =>
      useChat.getState().setTyping(d.conversationId, d.username, true);
    const onTypingStop = (d: { conversationId: string; username: string }) =>
      useChat.getState().setTyping(d.conversationId, d.username, false);

    channel.bind('message:new', onNew);
    channel.bind('message:edited', onEdited);
    channel.bind('message:deleted', onDeleted);
    channel.bind('message:read', onRead);
    channel.bind('typing:start', onTypingStart);
    channel.bind('typing:stop', onTypingStop);

    return () => {
      channel.unbind_all();
      presence.unbind_all();
      pusher.unsubscribe(userChannelName(user.id));
      pusher.unsubscribe(PRESENCE_CHANNEL);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    return () => {
      if (!useAuth.getState().user) disconnectPusher();
    };
  }, []);
}
