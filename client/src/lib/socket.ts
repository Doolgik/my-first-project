import Pusher, { type Channel, type PresenceChannel } from 'pusher-js';
import { api, getAccessToken } from './api';

/**
 * Realtime client over the Pusher protocol. Connects to Pusher Channels in
 * production (or a self-hosted/soketi broker locally). Channel auth is delegated
 * to our backend `/api/realtime/auth` endpoint, carrying the JWT.
 */
const API_BASE = import.meta.env.VITE_API_URL || '/api';
const KEY = import.meta.env.VITE_PUSHER_KEY || 'app-key';
const CLUSTER = import.meta.env.VITE_PUSHER_CLUSTER || 'mt1';
const HOST = import.meta.env.VITE_PUSHER_HOST;
const PORT = import.meta.env.VITE_PUSHER_PORT;
const USE_TLS = import.meta.env.VITE_PUSHER_USE_TLS === 'true';

let pusher: Pusher | null = null;
export const PRESENCE_CHANNEL = 'presence-online';

export function userChannelName(userId: string): string {
  return `private-user-${userId}`;
}

export function connectPusher(): Pusher {
  if (pusher) return pusher;

  pusher = new Pusher(KEY, {
    cluster: CLUSTER,
    forceTLS: HOST ? USE_TLS : true,
    ...(HOST
      ? { wsHost: HOST, wsPort: PORT ? Number(PORT) : 6001, wssPort: PORT ? Number(PORT) : 6001, enabledTransports: ['ws', 'wss'] as ('ws' | 'wss')[] }
      : {}),
    // Authorize private/presence channels through our API with the JWT.
    authorizer: (channel) => ({
      authorize: async (socketId, callback) => {
        try {
          const res = await api.post(
            '/realtime/auth',
            { socket_id: socketId, channel_name: channel.name },
            { headers: { Authorization: `Bearer ${getAccessToken()}` } }
          );
          callback(null, res.data);
        } catch (err) {
          callback(err as Error, null);
        }
      },
    }),
  });

  return pusher;
}

export function getPusher(): Pusher | null {
  return pusher;
}

export function disconnectPusher() {
  pusher?.disconnect();
  pusher = null;
}

export type { Channel, PresenceChannel };
// Silence unused warning for API_BASE (kept for clarity/parity with config).
void API_BASE;
