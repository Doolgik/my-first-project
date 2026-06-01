import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useChat } from '../store/chat';
import { useCalls } from '../store/calls';
import Avatar from './Avatar';
import { formatLastSeen } from '../lib/utils';
import type { User } from '../types';

interface Props {
  userId: string;
  onClose: () => void;
  onOpenConversation: (id: string) => void;
}

export default function UserProfileModal({ userId, onClose, onOpenConversation }: Props) {
  const { onlineUsers, startConversation, addContact, removeContact, isContact } = useChat();
  const startCall = useCalls((s) => s.startCall);
  const [user, setUser] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get(`/users/${userId}`).then((r) => setUser(r.data.user)).catch(() => setUser(null));
  }, [userId]);

  const online = onlineUsers.has(userId) || user?.isOnline;
  const contact = isContact(userId);

  const openChat = async () => {
    setBusy(true);
    const id = await startConversation(userId);
    setBusy(false);
    onClose();
    onOpenConversation(id);
  };

  const call = (media: 'audio' | 'video') => {
    if (!user) return;
    onClose();
    startCall(user, media);
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 backdrop-blur-md sm:items-center" onClick={onClose}>
      <div className="w-full max-w-md animate-sheet rounded-t-3xl glass-card p-6 pb-safe shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex justify-end">
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06]" aria-label="Close">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </div>

        {!user ? (
          <div className="py-10 text-center text-slate-500">Loading…</div>
        ) : (
          <>
            <div className="flex flex-col items-center text-center">
              <Avatar name={user.displayName} src={user.avatarUrl} size={104} showStatus online={online} />
              <h2 className="mt-3 text-xl font-bold text-white">{user.displayName}</h2>
              <p className="text-sm text-slate-400">@{user.username}</p>
              <p className="mt-0.5 text-xs text-slate-500">{formatLastSeen(online, user.lastSeen)}</p>
              {user.bio && <p className="mt-3 max-w-xs text-sm text-slate-300">{user.bio}</p>}
            </div>

            <div className="mt-6 grid grid-cols-3 gap-2">
              <button onClick={openChat} disabled={busy} className="flex flex-col items-center gap-1 rounded-2xl bg-white/[0.06] py-3 text-brand-400 transition hover:bg-white/10">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                <span className="text-xs">Message</span>
              </button>
              <button onClick={() => call('audio')} className="flex flex-col items-center gap-1 rounded-2xl bg-white/[0.06] py-3 text-emerald-400 transition hover:bg-white/10">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.81.36 1.6.7 2.34a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.74-1.27a2 2 0 0 1 2.11-.45c.74.34 1.53.57 2.34.7A2 2 0 0 1 22 16.92z" /></svg>
                <span className="text-xs">Call</span>
              </button>
              <button onClick={() => call('video')} className="flex flex-col items-center gap-1 rounded-2xl bg-white/[0.06] py-3 text-sky-400 transition hover:bg-white/10">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m23 7-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                <span className="text-xs">Video</span>
              </button>
            </div>

            <button
              onClick={() => (contact ? removeContact(userId) : addContact(userId))}
              className={`mt-3 w-full rounded-xl px-4 py-3 font-medium transition ${
                contact ? 'border border-slate-700 bg-white/[0.06] text-slate-300 hover:bg-white/10' : 'bg-brand-600 text-white hover:bg-brand-500'
              }`}
            >
              {contact ? 'Remove from contacts' : '+ Add to contacts'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
