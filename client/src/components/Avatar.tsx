import { resolveAvatar, initials, avatarColor } from '../lib/utils';

interface Props {
  name: string;
  src?: string | null;
  size?: number;
  online?: boolean;
  showStatus?: boolean;
}

export default function Avatar({ name, src, size = 48, online, showStatus }: Props) {
  const url = resolveAvatar(src);
  const dot = Math.max(10, Math.round(size * 0.28));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {url ? (
        <img
          src={url}
          alt={name}
          className="h-full w-full rounded-full object-cover"
          style={{ width: size, height: size }}
        />
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
          className={`absolute bottom-0 right-0 rounded-full border-2 border-slate-900 ${
            online ? 'bg-emerald-500' : 'bg-slate-500'
          }`}
          style={{ width: dot, height: dot }}
        />
      )}
    </div>
  );
}
