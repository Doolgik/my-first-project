export interface User {
  id: string;
  username: string;
  email?: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  isOnline?: boolean;
  lastSeen?: string;
}

export interface MessageRead {
  userId: string;
  readAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: Pick<User, 'id' | 'username' | 'displayName' | 'avatarUrl'>;
  content: string | null;
  deleted?: boolean;
  createdAt: string;
  editedAt?: string | null;
  reads: MessageRead[];
  pending?: boolean;
}

export interface Conversation {
  id: string;
  peer: User | null;
  lastMessage: {
    id: string;
    content: string | null;
    senderId: string;
    createdAt: string;
    deleted?: boolean;
  } | null;
  unreadCount: number;
  updatedAt: string;
}
