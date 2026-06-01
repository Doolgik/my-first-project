import { useEffect, useRef, useState } from 'react';
import { useChat } from '../store/chat';
import { useAuth } from '../store/auth';
import { api } from '../lib/api';
import Avatar from './Avatar';
import MessageBubble from './MessageBubble';
import { formatLastSeen } from '../lib/utils';
import type { Message } from '../types';

interface Props {
  conversationId: string;
  onBack: () => void;
}

export default function ChatWindow({ conversationId, onBack }: Props) {
  const user = useAuth((s) => s.user)!;
  const { messages, peers, typing, loadMessages, upsertMessage, replacePending, onlineUsers } = useChat();
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>();
  const isTyping = useRef(false);

  const list = messages[conversationId] ?? [];
  const peer = peers[conversationId];
  const peerOnline = peer ? onlineUsers.has(peer.id) || peer.isOnline : false;
  const typingUsers = (typing[conversationId] ?? []).filter((u) => u !== user.username);

  useEffect(() => {
    loadMessages(conversationId);
    api.post(`/conversations/${conversationId}/read`).catch(() => {});
  }, [conversationId, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [list.length, typingUsers.length]);

  const stopTyping = () => {
    if (isTyping.current) {
      isTyping.current = false;
      api.post(`/conversations/${conversationId}/typing`, { typing: false }).catch(() => {});
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    if (!isTyping.current) {
      isTyping.current = true;
      api.post(`/conversations/${conversationId}/typing`, { typing: true }).catch(() => {});
    }
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(stopTyping, 1500);
  };

  const send = async () => {
    const content = text.trim();
    if (!content) return;
    setText('');
    stopTyping();

    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      conversationId,
      senderId: user.id,
      sender: { id: user.id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl },
      content,
      createdAt: new Date().toISOString(),
      reads: [],
      pending: true,
    };
    upsertMessage(optimistic);

    try {
      const res = await api.post('/messages', { conversationId, content });
      if (res.data?.message) replacePending(tempId, res.data.message);
    } catch {
      // Leave the optimistic message flagged as pending on failure.
    }
  };

  const onEdit = (id: string, content: string) => {
    api.patch(`/messages/${id}`, { content }).catch(() => {});
  };
  const onDelete = (id: string) => {
    api.delete(`/messages/${id}`).catch(() => {});
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex h-full flex-col bg-slate-950">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-800 bg-slate-900 px-3 py-2.5 pt-safe">
        <button onClick={onBack} className="rounded-lg p-1.5 text-slate-300 transition hover:bg-slate-800 md:hidden" aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <Avatar name={peer?.displayName ?? '?'} src={peer?.avatarUrl} size={42} showStatus online={peerOnline} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">{peer?.displayName ?? 'Conversation'}</p>
          <p className="truncate text-xs text-slate-400">
            {typingUsers.length > 0 ? (
              <span className="text-brand-400">typing…</span>
            ) : (
              formatLastSeen(peerOnline, peer?.lastSeen)
            )}
          </p>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="scroll-thin flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
        {list.map((m) => (
          <MessageBubble key={m.id} message={m} mine={m.senderId === user.id} peerId={peer?.id} onEdit={onEdit} onDelete={onDelete} />
        ))}
        {typingUsers.length > 0 && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-slate-800 px-4 py-3">
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" />
              <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" />
            </div>
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="border-t border-slate-800 bg-slate-900 px-3 py-2 pb-safe">
        <div className="flex items-end gap-2">
          <textarea
            className="scroll-thin max-h-32 flex-1 resize-none rounded-2xl bg-slate-800 px-4 py-2.5 text-[15px] text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-brand-500/40"
            placeholder="Message…"
            rows={1}
            value={text}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onBlur={stopTyping}
          />
          <button
            onClick={send}
            disabled={!text.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-500 active:scale-95 disabled:opacity-40"
            aria-label="Send"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
