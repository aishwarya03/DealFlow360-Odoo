import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import multer from 'multer';

import ApiError from '../utils/apiError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Retained for cleanup of images uploaded before base64 storage was introduced.
export const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads', 'products');
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const MAX_IMAGE_BYTES = 1024 * 1024;

const fileFilter = (req, file, cb) => {
  if (!ALLOWED_MIME.has(file.mimetype)) {
    return cb(ApiError.badRequest('Image must be JPEG, PNG, or WebP'));
  }
  cb(null, true);
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: MAX_IMAGE_BYTES },
});

// Wraps multer's single-file middleware so its errors (wrong type, too large)
// go through the same ApiError -> errorHandler path as everything else,
// instead of multer's own default error shape.
const uploadProductImage = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return next(ApiError.badRequest('Image must be 1MB or smaller'));
    }
    return next(err);
  });
};

export default uploadProductImage;
