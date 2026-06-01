import { z } from 'zod';

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers and underscores'),
  email: z.string().email('Invalid email address').max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  displayName: z.string().min(1, 'Display name is required').max(60),
});

export const loginSchema = z.object({
  emailOrUsername: z.string().min(1, 'Email or username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(60).optional(),
  bio: z.string().max(280).optional().nullable(),
});

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid().optional(),
  recipientId: z.string().uuid().optional(),
  content: z.string().min(1, 'Message cannot be empty').max(4000),
}).refine((data) => data.conversationId || data.recipientId, {
  message: 'Either conversationId or recipientId is required',
});

export const editMessageSchema = z.object({
  content: z.string().min(1).max(4000),
});

export const createGroupSchema = z.object({
  title: z.string().min(1, 'Title is required').max(80),
  type: z.enum(['GROUP', 'CHANNEL']).default('GROUP'),
  memberIds: z.array(z.string().uuid()).max(200).default([]),
  avatarUrl: z.string().optional().nullable(),
});

export const updateConversationSchema = z.object({
  title: z.string().min(1).max(80).optional(),
  description: z.string().max(280).optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
});

export const addMemberSchema = z.object({
  userId: z.string().uuid(),
});

export const addContactSchema = z.object({
  contactId: z.string().uuid(),
});

export const callSignalSchema = z.object({
  toUserId: z.string().uuid(),
  type: z.enum(['offer', 'answer', 'ice', 'end', 'reject', 'cancel', 'busy']),
  callId: z.string().max(100),
  media: z.enum(['audio', 'video']).optional(),
  payload: z.any().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
