import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  uploadPdfOnly,
  uploadIzin,
  uploadImageOnly,
  verifyMagicBytes,
} from '../middlewares/upload.js';
import { pklController } from '../controllers/pkl.controller.js';
import { absensiController } from '../controllers/absensi.controller.js';
import { keuanganController } from '../controllers/keuangan.controller.js';
import { createIzinSchema } from '../validations/absensi.validation.js';
import { createPembayaranSchema, tagihanQuerySchema } from '../validations/keuangan.validation.js';

const router = Router();

// Semua endpoint siswa mewajibkan autentikasi JWT dan role siswa
router.use(authenticate, requireRole('siswa'));

// 1. PKL
router.get('/pkl', (req, res, next) => pklController.getStatusPkl(req, res, next));
router.get('/pkl/nilai', (req, res, next) => pklController.getNilaiPkl(req, res, next));
router.post(
  '/pkl/laporan',
  uploadPdfOnly.single('file'),
  verifyMagicBytes(['application/pdf']),
  (req, res, next) => pklController.uploadLaporan(req, res, next)
);

// 2. Absensi
router.get('/absensi/rekap', (req, res, next) => absensiController.getRekapSiswa(req, res, next));
router.post(
  '/izin',
  uploadIzin.single('lampiran'),
  verifyMagicBytes(['image/jpeg', 'image/png', 'application/pdf']),
  validate({ body: createIzinSchema }),
  (req, res, next) => absensiController.createIzin(req, res, next)
);

// 3. Keuangan
router.get(
  '/tagihan',
  validate({ query: tagihanQuerySchema }),
  (req, res, next) => keuanganController.getTagihanSiswa(req, res, next)
);
router.get('/tagihan/ringkasan', (req, res, next) => keuanganController.getRingkasanTagihan(req, res, next));
router.get('/info-pembayaran', (req, res, next) => keuanganController.getInfoPembayaran(req, res, next));
router.post(
  '/pembayaran',
  uploadImageOnly.single('bukti'),
  verifyMagicBytes(['image/jpeg', 'image/png']),
  validate({ body: createPembayaranSchema }),
  (req, res, next) => keuanganController.createPembayaran(req, res, next)
);

export default router;
