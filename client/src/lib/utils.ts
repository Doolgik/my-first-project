import { format, isToday, isYesterday } from 'date-fns';

const ASSET_BASE = import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/api$/, '') : '';

export function resolveAvatar(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${ASSET_BASE}${url}`;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

const AVATAR_COLORS = ['#6366f1', '#ec4899', '#14b8a6', '#f59e0b', '#8b5cf6', '#ef4444', '#0ea5e9'];
export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export function formatTime(date: string | Date): string {
  return format(new Date(date), 'HH:mm');
}

export function formatListTime(date: string | Date): string {
  const d = new Date(date);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'dd MMM');
}

export function formatLastSeen(isOnline?: boolean, lastSeen?: string): string {
  if (isOnline) return 'online';
  if (!lastSeen) return 'offline';
  const d = new Date(lastSeen);
  if (isToday(d)) return `last seen at ${format(d, 'HH:mm')}`;
  if (isYesterday(d)) return `last seen yesterday`;
  return `last seen ${format(d, 'dd MMM')}`;
}
