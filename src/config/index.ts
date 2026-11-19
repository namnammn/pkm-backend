import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/portal_siswa',
  jwtSecret: process.env.JWT_SECRET || 'super-secret-jwt-key-for-portal-siswa-2026',
  uploadDir: path.resolve(process.env.UPLOAD_DIR || './uploads'),
  bobotNilai: {
    sekolah: parseFloat(process.env.BOBOT_NILAI_SEKOLAH || '40'),
    industri: parseFloat(process.env.BOBOT_NILAI_INDUSTRI || '60'),
  },
};
