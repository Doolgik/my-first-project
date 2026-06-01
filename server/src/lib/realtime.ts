import Pusher from 'pusher';

/**
 * Realtime layer backed by the Pusher protocol.
 *
 * In production this points at Pusher Channels (or any Pusher-compatible host
 * such as a self-hosted soketi). Because the persistent WebSocket connections
 * live on that managed service — not on our HTTP process — the backend can run
 * on serverless platforms like Vercel, which cannot hold long-lived sockets.
 *
 * If credentials are not configured the trigger calls become no-ops so the API
 * still works (just without realtime push).
 */
const hasConfig = !!(process.env.PUSHER_APP_ID && process.env.PUSHER_KEY && process.env.PUSHER_SECRET);

export const pusher: Pusher | null = hasConfig
  ? new Pusher({
      appId: process.env.PUSHER_APP_ID!,
      key: process.env.PUSHER_KEY!,
      secret: process.env.PUSHER_SECRET!,
      ...(process.env.PUSHER_HOST
        ? {
            host: process.env.PUSHER_HOST,
            port: process.env.PUSHER_PORT ?? '443',
            useTLS: process.env.PUSHER_USE_TLS === 'true',
          }
        : {
            cluster: process.env.PUSHER_CLUSTER ?? 'mt1',
            useTLS: true,
          }),
    })
  : null;

export function realtimeEnabled() {
  return pusher !== null;
}

export function userChannel(userId: string): string {
  return `private-user-${userId}`;
}

export const PRESENCE_CHANNEL = 'presence-online';

/** Trigger an event on a single user's private channel. */
export async function triggerToUser(userId: string, event: string, payload: unknown) {
  if (!pusher) return;
  try {
    await pusher.trigger(userChannel(userId), event, payload);
  } catch (err) {
    console.error('Pusher trigger failed:', (err as Error).message);
  }
}

/** Trigger an event on several users' channels in one batch. */
export async function triggerToUsers(userIds: string[], event: string, payload: unknown) {
  if (!pusher || userIds.length === 0) return;
  try {
    const channels = userIds.map(userChannel);
    // Pusher allows up to 100 channels per trigger call.
    for (let i = 0; i < channels.length; i += 100) {
      await pusher.trigger(channels.slice(i, i + 100), event, payload);
    }
  } catch (err) {
    console.error('Pusher trigger failed:', (err as Error).message);
  }
}
