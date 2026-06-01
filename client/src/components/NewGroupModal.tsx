import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useChat } from '../store/chat';
import Avatar from './Avatar';
import type { User } from '../types';

interface Props {
  initialType: 'GROUP' | 'CHANNEL';
  onClose: () => void;
  onCreated: (id: string) => void;
}

export default function NewGroupModal({ initialType, onClose, onCreated }: Props) {
  const { contacts, loadContacts, createGroup } = useChat();
  const [type, setType] = useState<'GROUP' | 'CHANNEL'>(initialType);
  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [selected, setSelected] = useState<User[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await api.get('/users/search', { params: { q: query.trim() } });
      setResults(res.data.users);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const pool = query.trim() ? results : contacts;
  const toggle = (u: User) =>
    setSelected((s) => (s.some((x) => x.id === u.id) ? s.filter((x) => x.id !== u.id) : [...s, u]));

  const create = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const id = await createGroup(title.trim(), type, selected.map((u) => u.id));
      onCreated(id);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-md p-4" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-md animate-fade-in flex-col rounded-3xl glass-card shadow-2xl " onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <h2 className="text-lg font-semibold text-white">New {type === 'CHANNEL' ? 'channel' : 'group'}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06]" aria-label="Close">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto p-5 scroll-thin">
          <div className="flex gap-2 rounded-2xl bg-white/[0.06] p-1">
            {(['GROUP', 'CHANNEL'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${type === t ? 'bg-brand-600 text-white' : 'text-slate-400'}`}
              >
                {t === 'GROUP' ? 'Group' : 'Channel'}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            {type === 'GROUP' ? 'Everyone can send messages.' : 'Only admins post; members follow along.'}
          </p>

          <input className="input" placeholder={`${type === 'CHANNEL' ? 'Channel' : 'Group'} name`} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />

          {selected.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selected.map((u) => (
                <button key={u.id} onClick={() => toggle(u)} className="flex items-center gap-1 rounded-full bg-brand-600/20 px-2 py-1 text-xs text-brand-300">
                  {u.displayName} ✕
                </button>
              ))}
            </div>
          )}

          <input className="input" placeholder="Search people to add…" value={query} autoCapitalize="none" onChange={(e) => setQuery(e.target.value)} />

          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{query.trim() ? 'Results' : 'Contacts'}</p>
            {pool.length === 0 && <p className="py-4 text-center text-sm text-slate-500">No people</p>}
            {pool.map((u) => {
              const on = selected.some((x) => x.id === u.id);
              return (
                <button key={u.id} onClick={() => toggle(u)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-white/[0.06]">
                  <Avatar name={u.displayName} src={u.avatarUrl} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-white">{u.displayName}</p>
                    <p className="truncate text-xs text-slate-500">@{u.username}</p>
                  </div>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${on ? 'border-brand-500 bg-brand-600 text-white' : 'border-slate-600'}`}>
                    {on && '✓'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-white/8 p-4 pb-safe">
          <button className="btn-primary w-full" disabled={!title.trim() || creating} onClick={create}>
            {creating ? 'Creating…' : `Create ${type === 'CHANNEL' ? 'channel' : 'group'}`}
          </button>
        </div>
      </div>
    </div>
  );
}
