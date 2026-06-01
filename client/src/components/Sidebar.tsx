import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useChat } from '../store/chat';
import { useAuth } from '../store/auth';
import Avatar from './Avatar';
import { formatListTime } from '../lib/utils';
import type { User } from '../types';

interface Props {
  onSelect: (conversationId: string) => void;
  onOpenProfile: (userId: string) => void;
  onOpenSettings: () => void;
  onNewGroup: (type: 'GROUP' | 'CHANNEL') => void;
}

type Tab = 'chats' | 'contacts';

export default function Sidebar({ onSelect, onOpenProfile, onOpenSettings, onNewGroup }: Props) {
  const { conversations, activeId, onlineUsers, contacts, loadConversations, loadContacts } = useChat();
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useState<Tab>('chats');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    loadConversations();
    loadContacts();
  }, [loadConversations, loadContacts]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      try {
        const res = await api.get('/users/search', { params: { q: query.trim() } });
        setResults(res.data.users);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query]);

  return (
    <div className="flex h-full flex-col bg-slate-900">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-slate-800 px-4 py-3 pt-safe">
        <button onClick={onOpenSettings} className="shrink-0 transition active:scale-95">
          <Avatar name={user?.displayName ?? '?'} src={user?.avatarUrl} size={40} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">{user?.displayName}</p>
          <p className="truncate text-xs text-slate-500">@{user?.username}</p>
        </div>
        <div className="relative">
          <button onClick={() => setMenuOpen((m) => !m)} className="rounded-lg p-2 text-slate-300 transition hover:bg-slate-800" aria-label="New">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-slate-700 bg-slate-800 shadow-xl animate-fade-in">
                <button onClick={() => { setMenuOpen(false); setTab('chats'); setQuery(''); document.getElementById('sb-search')?.focus(); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-700">
                  <span>🔍</span> New chat
                </button>
                <button onClick={() => { setMenuOpen(false); onNewGroup('GROUP'); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-700">
                  <span>👥</span> New group
                </button>
                <button onClick={() => { setMenuOpen(false); onNewGroup('CHANNEL'); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-slate-700">
                  <span>📢</span> New channel
                </button>
              </div>
            </>
          )}
        </div>
        <button onClick={onOpenSettings} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white" aria-label="Settings">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
          <input id="sb-search" className="w-full rounded-xl bg-slate-800 py-2.5 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 outline-none focus:ring-2 focus:ring-brand-500/40" placeholder="Search people…" value={query} autoCapitalize="none" onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      {/* Tabs */}
      {!query.trim() && (
        <div className="flex gap-1 px-3 pb-1">
          {(['chats', 'contacts'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-lg py-1.5 text-sm font-medium capitalize transition ${tab === t ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
              {t}
            </button>
          ))}
        </div>
      )}

      {/* List */}
      <div className="scroll-thin flex-1 overflow-y-auto">
        {query.trim() ? (
          <div>
            <p className="px-4 py-1 text-xs font-medium uppercase tracking-wide text-slate-500">{searching ? 'Searching…' : results.length ? 'People' : 'No users found'}</p>
            {results.map((u) => (
              <button key={u.id} onClick={() => onOpenProfile(u.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-800">
                <Avatar name={u.displayName} src={u.avatarUrl} size={44} showStatus online={onlineUsers.has(u.id) || u.isOnline} />
                <div className="min-w-0"><p className="truncate font-medium text-white">{u.displayName}</p><p className="truncate text-xs text-slate-500">@{u.username}</p></div>
              </button>
            ))}
          </div>
        ) : tab === 'contacts' ? (
          contacts.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-slate-500">No contacts yet.<br />Search and open a profile to add one.</div>
          ) : (
            contacts.map((u) => (
              <button key={u.id} onClick={() => onOpenProfile(u.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-slate-800">
                <Avatar name={u.displayName} src={u.avatarUrl} size={46} showStatus online={onlineUsers.has(u.id) || u.isOnline} />
                <div className="min-w-0"><p className="truncate font-medium text-white">{u.displayName}</p><p className="truncate text-xs text-slate-500">@{u.username}</p></div>
              </button>
            ))
          )
        ) : conversations.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-slate-500">No conversations yet.<br />Search for someone or create a group.</div>
        ) : (
          conversations.map((c) => {
            const online = c.peer ? onlineUsers.has(c.peer.id) || c.peer.isOnline : false;
            const preview = c.lastMessage?.deleted ? 'Message deleted' : c.lastMessage?.content ?? 'No messages yet';
            const isMineLast = c.lastMessage?.senderId === user?.id;
            return (
              <button key={c.id} onClick={() => onSelect(c.id)} className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-slate-800 ${activeId === c.id ? 'bg-slate-800' : ''}`}>
                <Avatar name={c.title} src={c.avatarUrl} size={50} kind={c.type} showStatus={c.type === 'DIRECT'} online={online} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="flex items-center gap-1 truncate font-medium text-white">
                      {c.type === 'CHANNEL' && <span className="text-slate-500">📢</span>}
                      {c.type === 'GROUP' && <span className="text-slate-500">👥</span>}
                      {c.title}
                    </p>
                    {c.lastMessage && <span className="shrink-0 text-[11px] text-slate-500">{formatListTime(c.lastMessage.createdAt)}</span>}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm text-slate-400">{isMineLast && <span className="text-slate-500">You: </span>}{preview}</p>
                    {c.unreadCount > 0 && <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-600 px-1.5 text-[11px] font-semibold text-white">{c.unreadCount}</span>}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
