import { create } from 'zustand';
import { api } from '../lib/api';
import type { Conversation, Message, User } from '../types';

interface ChatState {
  conversations: Conversation[];
  activeId: string | null;
  messages: Record<string, Message[]>;
  peers: Record<string, User | null>;
  onlineUsers: Set<string>;
  typing: Record<string, string[]>; // conversationId -> usernames typing

  loadConversations: () => Promise<void>;
  setActive: (id: string | null) => void;
  loadMessages: (conversationId: string) => Promise<void>;
  startConversation: (recipientId: string) => Promise<string>;

  upsertMessage: (msg: Message) => void;
  replacePending: (tempId: string, msg: Message) => void;
  editMessageLocal: (id: string, conversationId: string, content: string, editedAt: string) => void;
  deleteMessageLocal: (id: string, conversationId: string) => void;
  markReadLocal: (conversationId: string, readerId: string, messageIds: string[], readAt: string) => void;

  setPresence: (userId: string, isOnline: boolean, lastSeen?: string) => void;
  setOnlineList: (ids: string[]) => void;
  setTyping: (conversationId: string, username: string, isTyping: boolean) => void;
}

export const useChat = create<ChatState>((set, get) => ({
  conversations: [],
  activeId: null,
  messages: {},
  peers: {},
  onlineUsers: new Set(),
  typing: {},

  loadConversations: async () => {
    const res = await api.get('/conversations');
    set({ conversations: res.data.conversations });
  },

  setActive: (id) => set({ activeId: id }),

  loadMessages: async (conversationId) => {
    const res = await api.get(`/conversations/${conversationId}/messages`);
    set((s) => ({
      messages: { ...s.messages, [conversationId]: res.data.messages },
      peers: { ...s.peers, [conversationId]: res.data.peer },
    }));
  },

  startConversation: async (recipientId) => {
    const res = await api.post('/conversations', { recipientId });
    const id = res.data.conversationId as string;
    await get().loadConversations();
    return id;
  },

  upsertMessage: (msg) => {
    set((s) => {
      const list = s.messages[msg.conversationId] ?? [];
      if (list.some((m) => m.id === msg.id)) {
        return {
          messages: {
            ...s.messages,
            [msg.conversationId]: list.map((m) => (m.id === msg.id ? msg : m)),
          },
        };
      }
      return {
        messages: { ...s.messages, [msg.conversationId]: [...list, msg] },
      };
    });
    // Bump conversation list ordering / preview.
    get().loadConversations();
  },

  replacePending: (tempId, msg) => {
    set((s) => {
      const list = s.messages[msg.conversationId] ?? [];
      const filtered = list.filter((m) => m.id !== tempId && m.id !== msg.id);
      return {
        messages: { ...s.messages, [msg.conversationId]: [...filtered, msg] },
      };
    });
  },

  editMessageLocal: (id, conversationId, content, editedAt) => {
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: (s.messages[conversationId] ?? []).map((m) =>
          m.id === id ? { ...m, content, editedAt } : m
        ),
      },
    }));
  },

  deleteMessageLocal: (id, conversationId) => {
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: (s.messages[conversationId] ?? []).map((m) =>
          m.id === id ? { ...m, deleted: true, content: null } : m
        ),
      },
    }));
  },

  markReadLocal: (conversationId, readerId, messageIds, readAt) => {
    set((s) => ({
      messages: {
        ...s.messages,
        [conversationId]: (s.messages[conversationId] ?? []).map((m) =>
          messageIds.includes(m.id)
            ? { ...m, reads: [...m.reads.filter((r) => r.userId !== readerId), { userId: readerId, readAt }] }
            : m
        ),
      },
    }));
  },

  setPresence: (userId, isOnline, lastSeen) => {
    set((s) => {
      const next = new Set(s.onlineUsers);
      if (isOnline) next.add(userId);
      else next.delete(userId);
      return {
        onlineUsers: next,
        conversations: s.conversations.map((c) =>
          c.peer?.id === userId ? { ...c, peer: { ...c.peer, isOnline, lastSeen: lastSeen ?? c.peer.lastSeen } } : c
        ),
        peers: Object.fromEntries(
          Object.entries(s.peers).map(([k, v]) =>
            v?.id === userId ? [k, { ...v, isOnline, lastSeen: lastSeen ?? v.lastSeen }] : [k, v]
          )
        ),
      };
    });
  },

  setOnlineList: (ids) => set({ onlineUsers: new Set(ids) }),

  setTyping: (conversationId, username, isTyping) => {
    set((s) => {
      const current = s.typing[conversationId] ?? [];
      const next = isTyping
        ? [...new Set([...current, username])]
        : current.filter((u) => u !== username);
      return { typing: { ...s.typing, [conversationId]: next } };
    });
  },
}));
