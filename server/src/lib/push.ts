import webpush from 'web-push';
import { prisma } from './prisma.js';

const PUBLIC = process.env.VAPID_PUBLIC_KEY;
const PRIVATE = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:admin@pulse.app';

const enabled = !!(PUBLIC && PRIVATE);
if (enabled) {
  webpush.setVapidDetails(SUBJECT, PUBLIC!, PRIVATE!);
}

export function pushEnabled() {
  return enabled;
}

export interface PushPayload {
  title: string;
  body: string;
  tag?: string;
  conversationId?: string;
  type?: 'message' | 'call';
}

/**
 * Send a Web Push notification to every device of the given users (excluding
 * the sender). Subscriptions that are gone (404/410) are pruned.
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload, excludeUserId?: string) {
  if (!enabled || userIds.length === 0) return;
  const targets = userIds.filter((id) => id !== excludeUserId);
  if (targets.length === 0) return;

  const subs = await prisma.pushSubscription.findMany({ where: { userId: { in: targets } } });
  const data = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          data
        );
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        }
      }
    })
  );
}
