import multer from 'multer';
import { ApiError } from '../utils/errors.js';
import { env } from '../config/env.js';

const ALLOWED = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * Avatars are kept in memory and persisted as data URLs (see upload controller).
 * This keeps the backend stateless so it can run on serverless platforms like
 * Vercel where the local filesystem is ephemeral.
 */
export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadBytes },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED.includes(file.mimetype)) {
      return cb(ApiError.badRequest('Only JPEG, PNG, GIF and WebP images are allowed'));
    }
    cb(null, true);
  },
}).single('avatar');
