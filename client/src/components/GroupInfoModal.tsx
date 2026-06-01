import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useChat } from '../store/chat';
import { useAuth } from '../store/auth';
import Avatar from './Avatar';
import type { ConversationMeta, User } from '../types';

interface Props {
  meta: ConversationMeta;
  onClose: () => void;
  onLeft: () => void;
  onOpenProfile: (userId: string) => void;
}

export default function GroupInfoModal({ meta, onClose, onLeft, onOpenProfile }: Props) {
  const me = useAuth((s) => s.user)!;
  const { members, loadMembers, loadConversations, onlineUsers } = useChat();
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(meta.title);

  const list = members[meta.id] ?? [];
  const myRole = list.find((m) => m.id === me.id)?.role ?? meta.myRole ?? 'MEMBER';
  const canManage = myRole === 'OWNER' || myRole === 'ADMIN';

  useEffect(() => {
    loadMembers(meta.id);
  }, [meta.id, loadMembers]);

  useEffect(() => {
    if (!query.trim()) return setResults([]);
    const t = setTimeout(async () => {
      const res = await api.get('/users/search', { params: { q: query.trim() } });
      setResults(res.data.users.filter((u: User) => !list.some((m) => m.id === u.id)));
    }, 300);
    return () => clearTimeout(t);
  }, [query, list]);

  const addMember = async (u: User) => {
    await api.post(`/conversations/${meta.id}/members`, { userId: u.id });
    await loadMembers(meta.id);
    setQuery('');
    setResults([]);
    setAdding(false);
  };
  const removeMember = async (userId: string) => {
    await api.delete(`/conversations/${meta.id}/members/${userId}`);
    await loadMembers(meta.id);
  };
  const leave = async () => {
    await api.delete(`/conversations/${meta.id}/members/${me.id}`);
    await loadConversations();
    onLeft();
  };
  const saveTitle = async () => {
    if (title.trim() && title !== meta.title) {
      await api.patch(`/conversations/${meta.id}`, { title: title.trim() });
      await loadConversations();
    }
    setEditingTitle(false);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-md animate-fade-in flex-col rounded-t-2xl bg-slate-900 shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">{meta.type === 'CHANNEL' ? 'Channel' : 'Group'} info</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800" aria-label="Close">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="overflow-y-auto p-5 scroll-thin">
          <div className="mb-5 flex flex-col items-center text-center">
            <Avatar name={meta.title} src={meta.avatarUrl} size={88} kind={meta.type} />
            {editingTitle ? (
              <div className="mt-3 flex w-full max-w-xs gap-2">
                <input className="input py-2" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
                <button onClick={saveTitle} className="rounded-lg bg-brand-600 px-3 text-sm font-medium text-white">Save</button>
              </div>
            ) : (
              <h3 className="mt-3 flex items-center gap-2 text-xl font-bold text-white">
                {meta.title}
                {canManage && (
                  <button onClick={() => setEditingTitle(true)} className="text-slate-500 hover:text-slate-300" aria-label="Edit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" /></svg>
                  </button>
                )}
              </h3>
            )}
            <p className="text-sm text-slate-500">{list.length} members</p>
          </div>

          {canManage && (
            <div className="mb-3">
              {adding ? (
                <div>
                  <input className="input" placeholder="Search people…" value={query} autoFocus autoCapitalize="none" onChange={(e) => setQuery(e.target.value)} />
                  <div className="mt-2 space-y-1">
                    {results.map((u) => (
                      <button key={u.id} onClick={() => addMember(u)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-800">
                        <Avatar name={u.displayName} src={u.avatarUrl} size={36} />
                        <span className="text-sm text-white">{u.displayName}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <button onClick={() => setAdding(true)} className="flex w-full items-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-brand-400 transition hover:bg-slate-700">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></svg>
                  Add members
                </button>
              )}
            </div>
          )}

          <div className="space-y-1">
            {list.map((m) => (
              <div key={m.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-slate-800">
                <button onClick={() => m.id !== me.id && onOpenProfile(m.id)}>
                  <Avatar name={m.displayName} src={m.avatarUrl} size={42} showStatus online={onlineUsers.has(m.id) || m.isOnline} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">{m.displayName}{m.id === me.id && ' (you)'}</p>
                  <p className="truncate text-xs text-slate-500">@{m.username}</p>
                </div>
                {m.role !== 'MEMBER' && (
                  <span className="rounded-full bg-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">{m.role.toLowerCase()}</span>
                )}
                {canManage && m.id !== me.id && m.role !== 'OWNER' && (
                  <button onClick={() => removeMember(m.id)} className="text-slate-500 hover:text-red-400" aria-label="Remove">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-slate-800 p-4 pb-safe">
          <button onClick={leave} className="w-full rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 font-semibold text-red-400 transition hover:bg-red-500/20">
            Leave {meta.type === 'CHANNEL' ? 'channel' : 'group'}
          </button>
        </div>
      </div>
    </div>
  );
}
