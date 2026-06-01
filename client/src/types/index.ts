export type ConversationType = 'DIRECT' | 'GROUP' | 'CHANNEL';
export type ParticipantRole = 'OWNER' | 'ADMIN' | 'MEMBER';

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

export interface Member extends User {
  role: ParticipantRole;
  joinedAt?: string;
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

export interface ConversationMeta {
  id: string;
  type: ConversationType;
  title: string;
  description?: string | null;
  avatarUrl?: string | null;
  ownerId?: string | null;
  memberCount?: number;
  myRole?: ParticipantRole;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  title: string;
  avatarUrl?: string | null;
  peer: User | null;
  memberCount?: number;
  myRole?: ParticipantRole;
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

export type CallMedia = 'audio' | 'video';
export type CallState = 'idle' | 'outgoing' | 'incoming' | 'connecting' | 'active' | 'ended';

export interface ActiveCall {
  callId: string;
  peer: User;
  media: CallMedia;
  state: CallState;
  isCaller: boolean;
}
