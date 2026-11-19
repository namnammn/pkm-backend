import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { fileTypeFromFile } from 'file-type';
import { config } from '../config/index.js';
import { BusinessRuleError } from '../utils/errors.js';

// Pastikan direktori upload ada
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

// Konfigurasi Multer Storage dengan penamaan acak yang aman
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (_req, file, cb) => {
    const randomHex = crypto.randomBytes(16).toString('hex');
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${randomHex}${ext}`);
  },
});

export const uploadPdfOnly = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

export const uploadIzin = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

export const uploadImageOnly = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
});

// Middleware verifikasi magic bytes & MIME
export function verifyMagicBytes(allowedMimes: string[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.file) {
      return next();
    }

    try {
      const typeResult = await fileTypeFromFile(req.file.path);
      const detectedMime = typeResult ? typeResult.mime : req.file.mimetype;

      if (!typeResult || !allowedMimes.includes(detectedMime)) {
        // Hapus file yang tidak valid dari disk
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        return next(
          new BusinessRuleError(
            'FILE_TYPE_INVALID',
            `Format file tidak sesuai ketentuan (${allowedMimes.join(', ')}). Ekstensi atau isi file tidak valid.`
          )
        );
      }

      next();
    } catch (err) {
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      next(err);
    }
  };
}
