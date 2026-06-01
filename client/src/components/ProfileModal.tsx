import { useRef, useState } from 'react';
import { useAuth } from '../store/auth';
import { api, apiErrorMessage } from '../lib/api';
import { disconnectPusher } from '../lib/socket';
import { resizeImage } from '../lib/image';
import Avatar from './Avatar';

interface Props {
  onClose: () => void;
}

export default function ProfileModal({ onClose }: Props) {
  const { user, setUser, logout } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const save = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await api.patch('/users/me', { displayName, bio });
      setUser({ ...user!, ...res.data.user });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const resized = await resizeImage(file);
      const fd = new FormData();
      fd.append('avatar', resized, 'avatar.jpg');
      const res = await api.post('/users/me/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUser({ ...user!, ...res.data.user });
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const doLogout = async () => {
    await logout();
    disconnectPusher();
  };

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md animate-fade-in rounded-t-2xl bg-slate-900 p-5 pb-safe shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Edit profile</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800" aria-label="Close">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-5 flex flex-col items-center">
          <button onClick={() => fileRef.current?.click()} className="relative transition active:scale-95">
            <Avatar name={user?.displayName ?? '?'} src={user?.avatarUrl} size={96} />
            <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-900 bg-brand-600 text-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
                <circle cx="12" cy="13" r="3" />
              </svg>
            </span>
          </button>
          <p className="mt-2 text-sm text-slate-500">{uploading ? 'Uploading…' : 'Tap to change avatar'}</p>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Display name</label>
            <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">Bio</label>
            <textarea
              className="input resize-none"
              rows={2}
              maxLength={280}
              value={bio ?? ''}
              placeholder="Tell people about yourself"
              onChange={(e) => setBio(e.target.value)}
            />
          </div>
          <div className="text-xs text-slate-500">@{user?.username} · {user?.email}</div>
          {error && <p className="text-sm text-red-400">{error}</p>}

          <button className="btn-primary w-full" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
          </button>
          <button
            onClick={doLogout}
            className="w-full rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 font-semibold text-red-400 transition hover:bg-red-500/20"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
