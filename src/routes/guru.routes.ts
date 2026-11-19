import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { pklController } from '../controllers/pkl.controller.js';
import { absensiController } from '../controllers/absensi.controller.js';
import { keuanganController } from '../controllers/keuangan.controller.js';
import {
  reviewLaporanSchema,
  inputNilaiPklSchema,
  paginationQuerySchema,
} from '../validations/pkl.validation.js';
import {
  inputAbsensiKelasSchema,
  putuskanIzinSchema,
  daftarIzinQuerySchema,
} from '../validations/absensi.validation.js';

const router = Router();

// Semua endpoint guru mewajibkan autentikasi JWT dan role guru
router.use(authenticate, requireRole('guru'));

// 1. PKL
router.get(
  '/pkl/siswa',
  validate({ query: paginationQuerySchema }),
  (req, res, next) => pklController.getSiswaBimbingan(req, res, next)
);
router.get('/pkl/laporan/:id', (req, res, next) => pklController.getLaporanDetail(req, res, next));
router.patch(
  '/pkl/laporan/:id/review',
  validate({ body: reviewLaporanSchema }),
  (req, res, next) => pklController.reviewLaporan(req, res, next)
);
router.put(
  '/pkl/siswa/:siswaId/nilai',
  validate({ body: inputNilaiPklSchema }),
  (req, res, next) => pklController.inputNilaiPkl(req, res, next)
);

// 2. Absensi
router.get(
  '/kelas/:kelasId/absensi/rekap',
  (req, res, next) => absensiController.getRekapKelas(req, res, next)
);
router.post(
  '/kelas/:kelasId/absensi',
  validate({ body: inputAbsensiKelasSchema }),
  (req, res, next) => absensiController.inputAbsensiKelas(req, res, next)
);
router.get(
  '/izin',
  validate({ query: daftarIzinQuerySchema }),
  (req, res, next) => absensiController.getDaftarIzin(req, res, next)
);
router.get('/izin/:id', (req, res, next) => absensiController.getIzinDetail(req, res, next));
router.patch(
  '/izin/:id/keputusan',
  validate({ body: putuskanIzinSchema }),
  (req, res, next) => absensiController.putuskanIzin(req, res, next)
);

// 3. Keuangan (Wali Kelas)
router.get(
  '/kelas/:kelasId/tagihan/status',
  validate({ query: paginationQuerySchema }),
  (req, res, next) => keuanganController.getStatusPembayaranKelas(req, res, next)
);

export default router;
