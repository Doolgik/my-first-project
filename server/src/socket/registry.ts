import type { Server } from 'socket.io';

/**
 * Tracks online users and the set of socket ids each user currently holds.
 * A user is "online" while they have at least one connected socket.
 */
const userSockets = new Map<string, Set<string>>();

let ioRef: Server | null = null;

export function setIo(io: Server) {
  ioRef = io;
}

export function getIo(): Server {
  if (!ioRef) throw new Error('Socket.IO server not initialized');
  return ioRef;
}

export function addUserSocket(userId: string, socketId: string): boolean {
  let set = userSockets.get(userId);
  const wasOffline = !set || set.size === 0;
  if (!set) {
    set = new Set();
    userSockets.set(userId, set);
  }
  set.add(socketId);
  return wasOffline;
}

export function removeUserSocket(userId: string, socketId: string): boolean {
  const set = userSockets.get(userId);
  if (!set) return true;
  set.delete(socketId);
  if (set.size === 0) {
    userSockets.delete(userId);
    return true; // now offline
  }
  return false;
}

export function isOnline(userId: string): boolean {
  const set = userSockets.get(userId);
  return !!set && set.size > 0;
}

export function getOnlineUserIds(): string[] {
  return [...userSockets.keys()];
}

/** Personal room every user socket joins, named after the user id. */
export function userRoom(userId: string): string {
  return `user:${userId}`;
}
