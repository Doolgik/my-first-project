import { resolveAvatar, initials, avatarColor } from '../lib/utils';

interface Props {
  name: string;
  src?: string | null;
  size?: number;
  online?: boolean;
  showStatus?: boolean;
  kind?: 'user' | 'GROUP' | 'CHANNEL' | 'DIRECT';
}

export default function Avatar({ name, src, size = 48, online, showStatus, kind = 'user' }: Props) {
  const url = resolveAvatar(src);
  const dot = Math.max(10, Math.round(size * 0.28));
  const isGroup = kind === 'GROUP' || kind === 'CHANNEL';

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {url ? (
        <img src={url} alt={name} className="h-full w-full rounded-full object-cover" style={{ width: size, height: size }} />
      ) : isGroup ? (
        <div
          className="flex h-full w-full items-center justify-center rounded-full text-white"
          style={{ background: avatarColor(name) }}
        >
          {kind === 'CHANNEL' ? (
            <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 11l18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
            </svg>
          ) : (
            <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          )}
        </div>
      ) : (
        <div
          className="flex h-full w-full items-center justify-center rounded-full font-semibold text-white"
          style={{ background: avatarColor(name), fontSize: size * 0.4 }}
        >
          {initials(name)}
        </div>
      )}
      {showStatus && (
        <span
          className={`absolute bottom-0 right-0 rounded-full border-2 border-slate-900 ${online ? 'bg-emerald-500' : 'bg-slate-500'}`}
          style={{ width: dot, height: dot }}
        />
      )}
    </div>
  );
}
