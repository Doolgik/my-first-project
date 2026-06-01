import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import { avatarUpload } from '../middleware/upload.js';
import * as auth from '../controllers/auth.controller.js';
import * as users from '../controllers/user.controller.js';
import * as messages from '../controllers/message.controller.js';
import * as upload from '../controllers/upload.controller.js';
import * as realtime from '../controllers/realtime.controller.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
});

// --- Auth ---
router.post('/auth/register', authLimiter, auth.register);
router.post('/auth/login', authLimiter, auth.login);
router.post('/auth/refresh', auth.refresh);
router.post('/auth/logout', auth.logout);
router.get('/auth/me', authenticate, auth.me);

// --- Users ---
router.get('/users/search', authenticate, users.searchUsers);
router.get('/users/:id', authenticate, users.getUser);
router.patch('/users/me', authenticate, users.updateProfile);
router.post('/users/me/avatar', authenticate, avatarUpload, upload.uploadAvatar);

// --- Conversations & messages ---
router.get('/conversations', authenticate, messages.getConversations);
router.post('/conversations', authenticate, messages.startConversation);
router.get('/conversations/:conversationId/messages', authenticate, messages.getMessages);
router.post('/conversations/:conversationId/read', authenticate, messages.markRead);
router.post('/conversations/:conversationId/typing', authenticate, messages.postTyping);

router.post('/messages', authenticate, messages.postMessage);
router.patch('/messages/:id', authenticate, messages.editMessage);
router.delete('/messages/:id', authenticate, messages.deleteMessage);

// --- Realtime (Pusher) channel authorization ---
router.post('/realtime/auth', authenticate, realtime.authorizeChannel);

export default router;
