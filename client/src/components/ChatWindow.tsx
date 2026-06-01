import { useEffect, useRef, useState } from 'react';
import { useChat } from '../store/chat';
import { useAuth } from '../store/auth';
import { useCalls } from '../store/calls';
import { api } from '../lib/api';
import Avatar from './Avatar';
import MessageBubble from './MessageBubble';
import { formatLastSeen } from '../lib/utils';
import type { Message } from '../types';

interface Props {
  conversationId: string;
  onBack: () => void;
  onOpenProfile: (userId: string) => void;
  onOpenGroupInfo: () => void;
}

export default function ChatWindow({ conversationId, onBack, onOpenProfile, onOpenGroupInfo }: Props) {
  const user = useAuth((s) => s.user)!;
  const { messages, peers, metas, typing, loadMessages, upsertMessage, replacePending, onlineUsers } = useChat();
  const startCall = useCalls((s) => s.startCall);
  const [text, setText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeout = useRef<ReturnType<typeof setTimeout>>();
  const isTyping = useRef(false);

  const list = messages[conversationId] ?? [];
  const peer = peers[conversationId];
  const meta = metas[conversationId];
  const isGroup = meta && meta.type !== 'DIRECT';
  const isChannel = meta?.type === 'CHANNEL';
  const canPost = !isChannel || meta?.myRole === 'OWNER' || meta?.myRole === 'ADMIN';
  const peerOnline = peer ? onlineUsers.has(peer.id) || peer.isOnline : false;
  const typingUsers = (typing[conversationId] ?? []).filter((u) => u !== user.username);

  const title = isGroup ? meta?.title ?? 'Group' : peer?.displayName ?? 'Conversation';
  const subtitle = isGroup
    ? `${meta?.memberCount ?? 0} members`
    : typingUsers.length > 0
    ? 'typing…'
    : formatLastSeen(peerOnline, peer?.lastSeen);

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
    upsertMessage({
      id: tempId,
      conversationId,
      senderId: user.id,
      sender: { id: user.id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl },
      content,
      createdAt: new Date().toISOString(),
      reads: [],
      pending: true,
    } as Message);
    try {
      const res = await api.post('/messages', { conversationId, content });
      if (res.data?.message) replacePending(tempId, res.data.message);
    } catch {
      /* keep pending */
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const openHeader = () => {
    if (isGroup) onOpenGroupInfo();
    else if (peer) onOpenProfile(peer.id);
  };

  return (
    <div className="flex h-full flex-col bg-slate-950">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-800 bg-slate-900 px-3 py-2.5 pt-safe">
        <button onClick={onBack} className="rounded-lg p-1.5 text-slate-300 transition hover:bg-slate-800 md:hidden" aria-label="Back">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6" /></svg>
        </button>
        <button onClick={openHeader} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <Avatar name={title} src={isGroup ? meta?.avatarUrl : peer?.avatarUrl} size={42} kind={meta?.type ?? 'DIRECT'} showStatus={!isGroup} online={peerOnline} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-white">{title}</p>
            <p className={`truncate text-xs ${subtitle === 'typing…' ? 'text-brand-400' : 'text-slate-400'}`}>{subtitle}</p>
          </div>
        </button>
        {!isGroup && peer && (
          <>
            <button onClick={() => startCall(peer, 'audio')} className="rounded-lg p-2 text-emerald-400 transition hover:bg-slate-800" aria-label="Call">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.7 2.34a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.74-1.27a2 2 0 0 1 2.11-.45c.74.34 1.53.57 2.34.7A2 2 0 0 1 22 16.92z" /></svg>
            </button>
            <button onClick={() => startCall(peer, 'video')} className="rounded-lg p-2 text-sky-400 transition hover:bg-slate-800" aria-label="Video call">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m23 7-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
            </button>
          </>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="scroll-thin flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
        {list.map((m, i) => {
          const mine = m.senderId === user.id;
          const prev = list[i - 1];
          const showSender = !!isGroup && !mine && (!prev || prev.senderId !== m.senderId);
          return (
            <MessageBubble
              key={m.id}
              message={m}
              mine={mine}
              peerId={peer?.id}
              showSender={showSender}
              onEdit={(id, content) => api.patch(`/messages/${id}`, { content }).catch(() => {})}
              onDelete={(id) => api.delete(`/messages/${id}`).catch(() => {})}
            />
          );
        })}
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
      {canPost ? (
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
            <button onClick={send} disabled={!text.trim()} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-500 active:scale-95 disabled:opacity-40" aria-label="Send">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
            </button>
          </div>
        </div>
      ) : (
        <div className="border-t border-slate-800 bg-slate-900 px-4 py-4 pb-safe text-center text-sm text-slate-500">
          📢 Only admins can post in this channel
        </div>
      )}
    </div>
  );
}
