import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../src/app.js';
import { config } from '../src/config/index.js';

// Mock database query and getClient
vi.mock('../src/config/db.js', () => {
  const mockClient = {
    query: vi.fn(),
    release: vi.fn(),
  };
  return {
    query: vi.fn(),
    getClient: vi.fn(() => Promise.resolve(mockClient)),
    pool: { query: vi.fn(), end: vi.fn() },
  };
});

import { query, getClient } from '../src/config/db.js';

const app = createApp();

function generateToken(userId: string, role: 'siswa' | 'guru') {
  return jwt.sign({ userId, role }, config.jwtSecret, { expiresIn: '1h' });
}

describe('Web Portal Siswa API Complete Test Suite (19 Endpoints)', () => {
  const tokenSiswa1 = generateToken('11111111-1111-1111-1111-111111111111', 'siswa');
  const tokenSiswa2 = generateToken('22222222-2222-2222-2222-222222222222', 'siswa');
  const tokenGuru1 = generateToken('33333333-3333-3333-3333-333333333333', 'guru'); // Wali kelas & guru pembimbing
  const tokenGuru2 = generateToken('44444444-4444-4444-4444-444444444444', 'guru'); // Pengajar di kelas_guru tapi bukan wali kelas
  const tokenGuru3 = generateToken('55555555-5555-5555-5555-555555555555', 'guru'); // Guru di luar relasi

  const validPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj 3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000053 00000 n\n0000000102 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n149\n%EOF\n');
  const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89]);
  const fakePdfBuffer = Buffer.from('Bukan berkas PDF valid, hanya teks acak');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================
  // S-PKL-1: GET /api/v1/siswa/pkl
  // ==========================================
  describe('S-PKL-1: GET /api/v1/siswa/pkl', () => {
    it('sukses mendapatkan status PKL dan laporan siswa', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM siswa WHERE user_id')) {
          return Promise.resolve({
            rows: [{ id: 's1', user_id: params[0], nis: '2324001', nama: 'Ahmad Fauzi', kelas_id: 'k1' }],
          });
        }
        if (sql.includes('FROM penempatan_pkl p')) {
          return Promise.resolve({
            rows: [
              {
                id: 'p1',
                siswa_id: 's1',
                dudi_id: 'd1',
                guru_pembimbing_id: 'g1',
                tanggal_mulai: '2026-09-01',
                tanggal_selesai: '2026-11-30',
                dudi_nama: 'PT Teknologi Nusantara',
                dudi_alamat: 'Jl. Merdeka No. 10',
                dudi_pembimbing_nama: 'Budi Santoso',
                dudi_pembimbing_kontak: '081234567890',
                guru_nama: 'Siti Rahma, S.Pd',
                guru_kontak: '081298765432',
                laporan_status: 'revisi',
                laporan_catatan: 'Bab 3 belum ada dokumentasi',
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .get('/api/v1/siswa/pkl')
        .set('Authorization', `Bearer ${tokenSiswa1}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.industri.nama).toBe('PT Teknologi Nusantara');
      expect(res.body.data.guruPembimbing.nama).toBe('Siti Rahma, S.Pd');
      expect(res.body.data.progres).toBeDefined();
      expect(res.body.data.laporan).toEqual({
        status: 'revisi',
        catatan: 'Bab 3 belum ada dokumentasi',
      });
    });

    it('gagal 401 bila token tidak disertakan', async () => {
      const res = await request(app).get('/api/v1/siswa/pkl');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('gagal 403 bila role bukan siswa', async () => {
      const res = await request(app)
        .get('/api/v1/siswa/pkl')
        .set('Authorization', `Bearer ${tokenGuru1}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('gagal 404 PKL_NOT_FOUND jika belum ada penempatan PKL', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM siswa WHERE user_id')) {
          return Promise.resolve({
            rows: [{ id: 's2', user_id: params[0], nis: '2324002', nama: 'Dewi', kelas_id: 'k1' }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .get('/api/v1/siswa/pkl')
        .set('Authorization', `Bearer ${tokenSiswa2}`);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('PKL_NOT_FOUND');
    });
  });

  // ==========================================
  // S-PKL-2: GET /api/v1/siswa/pkl/nilai
  // ==========================================
  describe('S-PKL-2: GET /api/v1/siswa/pkl/nilai', () => {
    it('sukses 200 dengan nilai null jika guru belum menginput', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM siswa WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 's1', user_id: params[0] }] });
        }
        if (sql.includes('FROM penempatan_pkl p')) {
          return Promise.resolve({ rows: [{ id: 'p1', siswa_id: 's1' }] });
        }
        if (sql.includes('FROM nilai_pkl')) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .get('/api/v1/siswa/pkl/nilai')
        .set('Authorization', `Bearer ${tokenSiswa1}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        sikap: null,
        keterampilan: null,
        kedisiplinan: null,
        nilaiAkhir: null,
      });
    });

    it('sukses 200 dengan nilai lengkap jika sudah dinilai', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM siswa WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 's1', user_id: params[0] }] });
        }
        if (sql.includes('FROM penempatan_pkl p')) {
          return Promise.resolve({ rows: [{ id: 'p1', siswa_id: 's1' }] });
        }
        if (sql.includes('FROM nilai_pkl')) {
          return Promise.resolve({
            rows: [{ nilai_sikap: 88, nilai_keterampilan: 85.5, nilai_kedisiplinan: 90, nilai_akhir: 87.6 }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .get('/api/v1/siswa/pkl/nilai')
        .set('Authorization', `Bearer ${tokenSiswa1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.nilaiAkhir).toBe(87.6);
    });
  });

  // ==========================================
  // S-PKL-3: POST /api/v1/siswa/pkl/laporan
  // ==========================================
  describe('S-PKL-3: POST /api/v1/siswa/pkl/laporan', () => {
    it('sukses 201 mengunggah laporan pertama kali (status menunggu)', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM siswa WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 's1', user_id: params[0] }] });
        }
        if (sql.includes('FROM penempatan_pkl p')) {
          return Promise.resolve({ rows: [{ id: 'p1', siswa_id: 's1' }] });
        }
        if (sql.includes('FROM laporan_pkl WHERE penempatan_id')) {
          return Promise.resolve({ rows: [] }); // Belum pernah upload
        }
        if (sql.includes('INSERT INTO laporan_pkl')) {
          return Promise.resolve({
            rows: [{ id: 'l1', status: 'menunggu', diupload_pada: '2026-11-11T08:30:00Z' }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .post('/api/v1/siswa/pkl/laporan')
        .set('Authorization', `Bearer ${tokenSiswa1}`)
        .attach('file', validPdfBuffer, 'laporan.pdf');

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('menunggu');
    });

    it('gagal 422 FILE_TYPE_INVALID jika mengunggah file palsu (bukan PDF)', async () => {
      const res = await request(app)
        .post('/api/v1/siswa/pkl/laporan')
        .set('Authorization', `Bearer ${tokenSiswa1}`)
        .attach('file', fakePdfBuffer, 'laporan.pdf');

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('FILE_TYPE_INVALID');
    });

    it('gagal 422 LAPORAN_TIDAK_DAPAT_DIUBAH jika status masih menunggu review', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM siswa WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 's1', user_id: params[0] }] });
        }
        if (sql.includes('FROM penempatan_pkl p')) {
          return Promise.resolve({ rows: [{ id: 'p1', siswa_id: 's1' }] });
        }
        if (sql.includes('FROM laporan_pkl') && sql.includes('penempatan_id = $1')) {
          return Promise.resolve({
            rows: [{ id: 'l1', status: 'menunggu', file_path: 'uploads/dummy.pdf' }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .post('/api/v1/siswa/pkl/laporan')
        .set('Authorization', `Bearer ${tokenSiswa1}`)
        .attach('file', validPdfBuffer, 'laporan.pdf');

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('LAPORAN_TIDAK_DAPAT_DIUBAH');
    });
  });

  // ==========================================
  // S-ABS-1: GET /api/v1/siswa/absensi/rekap
  // ==========================================
  describe('S-ABS-1: GET /api/v1/siswa/absensi/rekap', () => {
    it('sukses mendapatkan rekap absensi per bulan', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM siswa WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 's1', user_id: params[0] }] });
        }
        if (sql.includes('COUNT(*) FILTER')) {
          return Promise.resolve({
            rows: [{ hadir: 20, izin: 1, sakit: 2, alpa: 0 }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .get('/api/v1/siswa/absensi/rekap?bulan=2026-10')
        .set('Authorization', `Bearer ${tokenSiswa1}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ hadir: 20, izin: 1, sakit: 2, alpa: 0 });
    });

    it('sukses mendapatkan rekap absensi per semester', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM siswa WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 's1', user_id: params[0] }] });
        }
        if (sql.includes('FROM semester')) {
          return Promise.resolve({
            rows: [{ tanggal_mulai: '2026-07-01', tanggal_selesai: '2026-12-31' }],
          });
        }
        if (sql.includes('COUNT(*) FILTER')) {
          return Promise.resolve({
            rows: [{ hadir: 90, izin: 2, sakit: 3, alpa: 0 }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .get('/api/v1/siswa/absensi/rekap?semester=2026-2027-ganjil')
        .set('Authorization', `Bearer ${tokenSiswa1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.hadir).toBe(90);
    });

    it('gagal 422 VALIDATION_ERROR jika bulan dan semester dikirim bersamaan', async () => {
      const res = await request(app)
        .get('/api/v1/siswa/absensi/rekap?bulan=2026-10&semester=2026-2027-ganjil')
        .set('Authorization', `Bearer ${tokenSiswa1}`);

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ==========================================
  // S-ABS-2: POST /api/v1/siswa/izin
  // ==========================================
  describe('S-ABS-2: POST /api/v1/siswa/izin', () => {
    it('sukses mengajukan izin dengan lampiran berkas', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM siswa WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 's1', user_id: params[0] }] });
        }
        if (sql.includes('INSERT INTO izin')) {
          return Promise.resolve({
            rows: [
              {
                id: 'iz1',
                jenis: 'sakit',
                tanggal_mulai: '2026-11-12',
                tanggal_selesai: '2026-11-13',
                keterangan: 'Demam tinggi',
                status: 'menunggu',
                dibuat_pada: '2026-11-11T08:30:00Z',
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .post('/api/v1/siswa/izin')
        .set('Authorization', `Bearer ${tokenSiswa1}`)
        .field('jenis', 'sakit')
        .field('tanggalMulai', '2026-11-12')
        .field('tanggalSelesai', '2026-11-13')
        .field('keterangan', 'Demam tinggi')
        .attach('lampiran', validPngBuffer, 'surat.png');

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('menunggu');
      expect(res.body.data.jenis).toBe('sakit');
    });

    it('gagal 422 VALIDATION_ERROR bila tanggalSelesai lebih awal dari tanggalMulai', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM siswa WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 's1', user_id: params[0] }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .post('/api/v1/siswa/izin')
        .set('Authorization', `Bearer ${tokenSiswa1}`)
        .field('jenis', 'izin')
        .field('tanggalMulai', '2026-11-15')
        .field('tanggalSelesai', '2026-11-10')
        .attach('lampiran', validPngBuffer, 'surat.png');

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ==========================================
  // S-KEU-1: GET /api/v1/siswa/tagihan
  // ==========================================
  describe('S-KEU-1: GET /api/v1/siswa/tagihan', () => {
    it('sukses mendapatkan daftar tagihan siswa', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM siswa WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 's1', user_id: params[0] }] });
        }
        if (sql.includes('COUNT(*) AS total FROM tagihan')) {
          return Promise.resolve({ rows: [{ total: 2 }] });
        }
        if (sql.includes('FROM tagihan')) {
          return Promise.resolve({
            rows: [
              {
                id: 't1',
                komponen: 'SPP',
                keterangan: 'SPP November 2026',
                nominal: 350000,
                jatuh_tempo: '2026-11-10',
                status: 'Jatuh Tempo',
              },
              {
                id: 't2',
                komponen: 'UKK',
                keterangan: null,
                nominal: 500000,
                jatuh_tempo: '2026-12-15',
                status: 'Belum Lunas',
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .get('/api/v1/siswa/tagihan?status=Belum Lunas')
        .set('Authorization', `Bearer ${tokenSiswa1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 2 });
    });
  });

  // ==========================================
  // S-KEU-2: GET /api/v1/siswa/tagihan/ringkasan
  // ==========================================
  describe('S-KEU-2: GET /api/v1/siswa/tagihan/ringkasan', () => {
    it('sukses mendapatkan total ringkasan tagihan belum lunas', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM siswa WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 's1', user_id: params[0] }] });
        }
        if (sql.includes('COALESCE(SUM(nominal), 0)')) {
          return Promise.resolve({ rows: [{ total: 850000 }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .get('/api/v1/siswa/tagihan/ringkasan')
        .set('Authorization', `Bearer ${tokenSiswa1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.total).toBe(850000);
    });
  });

  // ==========================================
  // S-KEU-3: GET /api/v1/siswa/info-pembayaran
  // ==========================================
  describe('S-KEU-3: GET /api/v1/siswa/info-pembayaran', () => {
    it('sukses mendapatkan info pembayaran', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM siswa WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 's1', user_id: params[0] }] });
        }
        if (sql.includes('FROM info_pembayaran')) {
          return Promise.resolve({
            rows: [
              {
                id: 1,
                nama_bank: 'Bank Contoh',
                nomor_rekening: '1234567890',
                nama_penerima: 'SMK Contoh Nusantara',
                jadwal_loket: 'Senin - Jumat, 08.00 - 14.00 WIB',
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .get('/api/v1/siswa/info-pembayaran')
        .set('Authorization', `Bearer ${tokenSiswa1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.namaBank).toBe('Bank Contoh');
      expect(res.body.data.nomorRekening).toBe('1234567890');
    });
  });

  // ==========================================
  // S-KEU-4: POST /api/v1/siswa/pembayaran
  // ==========================================
  describe('S-KEU-4: POST /api/v1/siswa/pembayaran', () => {
    it('sukses mengunggah bukti pembayaran', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM siswa WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 's1', user_id: params[0] }] });
        }
        if (sql.includes('FROM tagihan') && sql.includes('siswa_id = $2')) {
          return Promise.resolve({
            rows: [{ id: 't1', siswa_id: 's1', nominal: 350000, lunas_pada: null }],
          });
        }
        if (sql.includes('INSERT INTO pembayaran')) {
          return Promise.resolve({
            rows: [
              {
                id: 'pay1',
                tagihan_id: 't1',
                nominal: 350000,
                tanggal_transfer: '2026-11-11',
                status: 'menunggu',
                diupload_pada: '2026-11-11T09:00:00Z',
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .post('/api/v1/siswa/pembayaran')
        .set('Authorization', `Bearer ${tokenSiswa1}`)
        .field('tagihanId', 'a1f00000-0000-0000-0000-000000000001')
        .field('nominal', '350000')
        .field('tanggalTransfer', '2026-11-11')
        .attach('bukti', validPngBuffer, 'bukti.png');

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('menunggu');
    });

    it('gagal 404 TAGIHAN_NOT_FOUND jika tagihan bukan milik siswa atau tidak ada', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM siswa WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 's1', user_id: params[0] }] });
        }
        if (sql.includes('FROM tagihan') && sql.includes('siswa_id = $2')) {
          return Promise.resolve({ rows: [] }); // Tagihan tidak ditemukan
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .post('/api/v1/siswa/pembayaran')
        .set('Authorization', `Bearer ${tokenSiswa1}`)
        .field('tagihanId', 'd8e30000-0000-0000-0000-000000000003')
        .field('nominal', '350000')
        .field('tanggalTransfer', '2026-11-11')
        .attach('bukti', validPngBuffer, 'bukti.png');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('TAGIHAN_NOT_FOUND');
    });

    it('gagal 422 TAGIHAN_SUDAH_LUNAS jika tagihan sudah berstatus lunas', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM siswa WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 's1', user_id: params[0] }] });
        }
        if (sql.includes('FROM tagihan') && sql.includes('siswa_id = $2')) {
          return Promise.resolve({
            rows: [{ id: 't1', siswa_id: 's1', nominal: 350000, lunas_pada: '2026-11-05T10:00:00Z' }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .post('/api/v1/siswa/pembayaran')
        .set('Authorization', `Bearer ${tokenSiswa1}`)
        .field('tagihanId', 'a1f00000-0000-0000-0000-000000000001')
        .field('nominal', '350000')
        .field('tanggalTransfer', '2026-11-11')
        .attach('bukti', validPngBuffer, 'bukti.png');

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('TAGIHAN_SUDAH_LUNAS');
    });
  });

  // ==========================================
  // G-PKL-1: GET /api/v1/guru/pkl/siswa
  // ==========================================
  describe('G-PKL-1: GET /api/v1/guru/pkl/siswa', () => {
    it('sukses mendapatkan daftar siswa bimbingan guru', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM guru WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 'g1', user_id: params[0] }] });
        }
        if (sql.includes('COUNT(*) AS total')) {
          return Promise.resolve({ rows: [{ total: 1 }] });
        }
        if (sql.includes('FROM penempatan_pkl p')) {
          return Promise.resolve({
            rows: [
              {
                siswa_id: 's1',
                nis: '2324001',
                siswa_nama: 'Ahmad Fauzi',
                tanggal_mulai: '2026-09-01',
                tanggal_selesai: '2026-11-30',
                dudi_nama: 'PT Teknologi Nusantara',
                dudi_alamat: 'Jl. Merdeka No. 10',
                dudi_pembimbing_nama: 'Budi Santoso',
                dudi_pembimbing_kontak: '081234567890',
                laporan_id: 'l1',
                laporan_status: 'menunggu',
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .get('/api/v1/guru/pkl/siswa')
        .set('Authorization', `Bearer ${tokenGuru1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].nama).toBe('Ahmad Fauzi');
      expect(res.body.data[0].laporan.status).toBe('menunggu');
    });

    it('gagal 403 jika diakses oleh akun role siswa', async () => {
      const res = await request(app)
        .get('/api/v1/guru/pkl/siswa')
        .set('Authorization', `Bearer ${tokenSiswa1}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ==========================================
  // G-PKL-2: GET /api/v1/guru/pkl/laporan/:id
  // ==========================================
  describe('G-PKL-2: GET /api/v1/guru/pkl/laporan/:id', () => {
    it('sukses mendapatkan detail metadata laporan siswa bimbingan', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM guru WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 'g1', user_id: params[0] }] });
        }
        if (sql.includes('FROM laporan_pkl l')) {
          return Promise.resolve({
            rows: [
              {
                id: 'l1',
                file_path: 'uploads/laporan-ahmad.pdf',
                status: 'menunggu',
                catatan: null,
                diupload_pada: '2026-11-11T08:30:00Z',
                diperiksa_pada: null,
                guru_pembimbing_id: 'g1',
                siswa_id: 's1',
                siswa_nis: '2324001',
                siswa_nama: 'Ahmad Fauzi',
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .get('/api/v1/guru/pkl/laporan/l1')
        .set('Authorization', `Bearer ${tokenGuru1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('l1');
      expect(res.body.data.siswa.nama).toBe('Ahmad Fauzi');
    });

    it('gagal 403 bila laporan bukan milik siswa bimbingan guru yang login', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM guru WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 'g3', user_id: params[0] }] });
        }
        if (sql.includes('FROM laporan_pkl l')) {
          return Promise.resolve({
            rows: [{ id: 'l1', guru_pembimbing_id: 'g1' }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .get('/api/v1/guru/pkl/laporan/l1')
        .set('Authorization', `Bearer ${tokenGuru3}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ==========================================
  // G-PKL-3: PATCH /api/v1/guru/pkl/laporan/:id/review
  // ==========================================
  describe('G-PKL-3: PATCH /api/v1/guru/pkl/laporan/:id/review', () => {
    it('sukses menyetujui laporan siswa bimbingan', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM guru WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 'g1', user_id: params[0] }] });
        }
        if (sql.includes('SELECT \n        l.id')) {
          return Promise.resolve({
            rows: [{ id: 'l1', guru_pembimbing_id: 'g1', status: 'menunggu', file_path: 'uploads/f.pdf', siswa_id: 's1', siswa_nis: '2324001', siswa_nama: 'Ahmad' }],
          });
        }
        if (sql.includes('UPDATE laporan_pkl')) {
          return Promise.resolve({
            rows: [{ id: 'l1', status: 'disetujui', catatan: 'Bagus', diperiksa_pada: '2026-11-12T10:00:00Z' }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .patch('/api/v1/guru/pkl/laporan/l1/review')
        .set('Authorization', `Bearer ${tokenGuru1}`)
        .send({ status: 'disetujui', catatan: 'Bagus' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('disetujui');
    });

    it('gagal 422 VALIDATION_ERROR jika status revisi tanpa catatan', async () => {
      const res = await request(app)
        .patch('/api/v1/guru/pkl/laporan/l1/review')
        .set('Authorization', `Bearer ${tokenGuru1}`)
        .send({ status: 'revisi' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('gagal 422 LAPORAN_TIDAK_DAPAT_DIREVIEW jika laporan sudah berstatus disetujui', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM guru WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 'g1', user_id: params[0] }] });
        }
        if (sql.includes('SELECT \n        l.id')) {
          return Promise.resolve({
            rows: [{ id: 'l1', guru_pembimbing_id: 'g1', status: 'disetujui' }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .patch('/api/v1/guru/pkl/laporan/l1/review')
        .set('Authorization', `Bearer ${tokenGuru1}`)
        .send({ status: 'disetujui' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('LAPORAN_TIDAK_DAPAT_DIREVIEW');
    });
  });

  // ==========================================
  // G-PKL-4: PUT /api/v1/guru/pkl/siswa/:siswaId/nilai
  // ==========================================
  describe('G-PKL-4: PUT /api/v1/guru/pkl/siswa/:siswaId/nilai', () => {
    it('sukses menginput nilai akhir PKL dan server menghitung nilaiAkhir otomatis', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM guru WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 'g1', user_id: params[0] }] });
        }
        if (sql.includes('FROM penempatan_pkl') && sql.includes('guru_pembimbing_id = $2')) {
          return Promise.resolve({ rows: [{ id: 'p1' }] });
        }
        if (sql.includes('INSERT INTO nilai_pkl')) {
          return Promise.resolve({
            rows: [
              {
                nilai_sekolah: 85,
                nilai_sikap: 88,
                nilai_keterampilan: 85.5,
                nilai_kedisiplinan: 90,
                nilai_akhir: 86.7,
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .put('/api/v1/guru/pkl/siswa/7f1c0000-0000-0000-0000-000000000001/nilai')
        .set('Authorization', `Bearer ${tokenGuru1}`)
        .send({
          nilaiSekolah: 85,
          nilaiIndustri: { sikap: 88, keterampilan: 85.5, kedisiplinan: 90 },
        });

      expect(res.status).toBe(200);
      expect(res.body.data.nilaiSekolah).toBe(85);
      expect(res.body.data.nilaiAkhir).toBe(86.7);
    });

    it('gagal 403 bila siswa bukan bimbingan guru yang login', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM guru WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 'g3', user_id: params[0] }] });
        }
        if (sql.includes('FROM penempatan_pkl') && sql.includes('guru_pembimbing_id = $2')) {
          return Promise.resolve({ rows: [] }); // Bukan siswa bimbingan
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .put('/api/v1/guru/pkl/siswa/7f1c0000-0000-0000-0000-000000000001/nilai')
        .set('Authorization', `Bearer ${tokenGuru3}`)
        .send({
          nilaiSekolah: 85,
          nilaiIndustri: { sikap: 88, keterampilan: 85, kedisiplinan: 90 },
        });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ==========================================
  // G-ABS-1: GET /api/v1/guru/kelas/:kelasId/absensi/rekap
  // ==========================================
  describe('G-ABS-1: GET /api/v1/guru/kelas/:kelasId/absensi/rekap', () => {
    it('sukses mendapatkan rekap kehadiran bulanan kelas untuk pengajar kelas_guru', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM guru WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 'g2', user_id: params[0] }] });
        }
        if (sql.includes('SELECT 1 FROM kelas WHERE id = $1')) {
          return Promise.resolve({ rows: [{ '?column?': 1 }], rowCount: 1 });
        }
        if (sql.includes('FROM kelas k')) {
          return Promise.resolve({ rows: [{ '?column?': 1 }], rowCount: 1 }); // hasAccess via kelas_guru
        }
        if (sql.includes('COUNT(*) AS total FROM siswa WHERE kelas_id = $1')) {
          return Promise.resolve({ rows: [{ total: 1 }] });
        }
        if (sql.includes('COUNT(*) FILTER')) {
          return Promise.resolve({
            rows: [{ siswa_id: 's1', nis: '2324001', nama: 'Ahmad Fauzi', hadir: 20, izin: 1, sakit: 0, alpa: 0 }],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .get('/api/v1/guru/kelas/k1/absensi/rekap?bulan=2026-10')
        .set('Authorization', `Bearer ${tokenGuru2}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].hadir).toBe(20);
    });

    it('gagal 403 bila guru bukan wali kelas dan bukan pengajar di kelas tersebut', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM guru WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 'g3', user_id: params[0] }] });
        }
        if (sql.includes('SELECT 1 FROM kelas WHERE id = $1')) {
          return Promise.resolve({ rows: [{ '?column?': 1 }], rowCount: 1 });
        }
        if (sql.includes('FROM kelas k')) {
          return Promise.resolve({ rows: [], rowCount: 0 }); // Tidak punya akses
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .get('/api/v1/guru/kelas/k1/absensi/rekap?bulan=2026-10')
        .set('Authorization', `Bearer ${tokenGuru3}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ==========================================
  // G-ABS-2: POST /api/v1/guru/kelas/:kelasId/absensi
  // ==========================================
  describe('G-ABS-2: POST /api/v1/guru/kelas/:kelasId/absensi', () => {
    it('sukses melakukan input absensi kelas secara atomik', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({}),
        release: vi.fn(),
      };
      (getClient as any).mockResolvedValue(mockClient);

      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM guru WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 'g1', user_id: params[0] }] });
        }
        if (sql.includes('SELECT 1 FROM kelas WHERE id = $1')) {
          return Promise.resolve({ rows: [{ '?column?': 1 }], rowCount: 1 });
        }
        if (sql.includes('FROM kelas k')) {
          return Promise.resolve({ rows: [{ '?column?': 1 }], rowCount: 1 });
        }
        if (sql.includes('SELECT id FROM siswa WHERE kelas_id = $1')) {
          return Promise.resolve({ rows: [{ id: '7f1c0000-0000-0000-0000-000000000001' }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .post('/api/v1/guru/kelas/k1/absensi')
        .set('Authorization', `Bearer ${tokenGuru1}`)
        .send({
          tanggal: '2026-11-10',
          data: [{ siswaId: '7f1c0000-0000-0000-0000-000000000001', status: 'hadir' }],
        });

      expect(res.status).toBe(201);
      expect(res.body.data.tersimpan).toBe(1);
    });

    it('gagal 422 SISWA_DUPLIKAT jika ada siswaId ganda dalam request', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM guru WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 'g1', user_id: params[0] }] });
        }
        if (sql.includes('SELECT 1 FROM kelas WHERE id = $1')) {
          return Promise.resolve({ rows: [{ '?column?': 1 }], rowCount: 1 });
        }
        if (sql.includes('FROM kelas k')) {
          return Promise.resolve({ rows: [{ '?column?': 1 }], rowCount: 1 });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .post('/api/v1/guru/kelas/k1/absensi')
        .set('Authorization', `Bearer ${tokenGuru1}`)
        .send({
          tanggal: '2026-11-10',
          data: [
            { siswaId: '7f1c0000-0000-0000-0000-000000000001', status: 'hadir' },
            { siswaId: '7f1c0000-0000-0000-0000-000000000001', status: 'alpa' },
          ],
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('SISWA_DUPLIKAT');
    });

    it('gagal 422 SISWA_BUKAN_ANGGOTA_KELAS jika ada siswa di luar kelas', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM guru WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 'g1', user_id: params[0] }] });
        }
        if (sql.includes('SELECT 1 FROM kelas WHERE id = $1')) {
          return Promise.resolve({ rows: [{ '?column?': 1 }], rowCount: 1 });
        }
        if (sql.includes('FROM kelas k')) {
          return Promise.resolve({ rows: [{ '?column?': 1 }], rowCount: 1 });
        }
        if (sql.includes('SELECT id FROM siswa WHERE kelas_id = $1')) {
          return Promise.resolve({ rows: [{ id: '7f1c0000-0000-0000-0000-000000000001' }] });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .post('/api/v1/guru/kelas/k1/absensi')
        .set('Authorization', `Bearer ${tokenGuru1}`)
        .send({
          tanggal: '2026-11-10',
          data: [
            { siswaId: '0a9b0000-0000-0000-0000-000000000099', status: 'hadir' },
          ],
        });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('SISWA_BUKAN_ANGGOTA_KELAS');
    });
  });

  // ==========================================
  // G-ABS-3: GET /api/v1/guru/izin
  // ==========================================
  describe('G-ABS-3: GET /api/v1/guru/izin', () => {
    it('sukses mendapatkan daftar pengajuan izin dari siswa kelas yang diampu', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM guru WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 'g1', user_id: params[0] }] });
        }
        if (sql.includes('COUNT(i.id) AS total')) {
          return Promise.resolve({ rows: [{ total: 1 }] });
        }
        if (sql.includes('FROM izin i')) {
          return Promise.resolve({
            rows: [
              {
                id: 'iz1',
                jenis: 'sakit',
                tanggal_mulai: '2026-11-12',
                tanggal_selesai: '2026-11-13',
                status: 'menunggu',
                dibuat_pada: '2026-11-11T08:30:00Z',
                siswa_id: 's1',
                nis: '2324001',
                nama: 'Ahmad Fauzi',
                kelas_nama: 'XII TKJ 1',
              },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .get('/api/v1/guru/izin?status=menunggu')
        .set('Authorization', `Bearer ${tokenGuru1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].siswa.nama).toBe('Ahmad Fauzi');
      expect(res.body.meta.total).toBe(1);
    });

    it('gagal 403 bila query kelasId bukan kelas yang diampu/diajar guru', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM guru WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 'g3', user_id: params[0] }] });
        }
        if (sql.includes('SELECT 1 FROM kelas WHERE id = $1')) {
          return Promise.resolve({ rows: [{ '?column?': 1 }], rowCount: 1 });
        }
        if (sql.includes('FROM kelas k')) {
          return Promise.resolve({ rows: [], rowCount: 0 }); // Tidak punya akses
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .get('/api/v1/guru/izin?kelasId=dddddddd-dddd-dddd-dddd-dddddddddddd')
        .set('Authorization', `Bearer ${tokenGuru3}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ==========================================
  // G-ABS-4: GET /api/v1/guru/izin/:id
  // ==========================================
  describe('G-ABS-4: GET /api/v1/guru/izin/:id', () => {
    it('sukses mendapatkan detail izin siswa', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM guru WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 'g1', user_id: params[0] }] });
        }
        if (sql.includes('FROM izin i')) {
          return Promise.resolve({
            rows: [
              {
                id: 'iz1',
                siswa_id: 's1',
                jenis: 'sakit',
                tanggal_mulai: '2026-11-12',
                tanggal_selesai: '2026-11-13',
                lampiran_path: 'uploads/surat.png',
                keterangan: 'Demam tinggi',
                status: 'menunggu',
                catatan: null,
                dibuat_pada: '2026-11-11T08:30:00Z',
                diputuskan_pada: null,
                siswa_nis: '2324001',
                siswa_nama: 'Ahmad Fauzi',
                kelas_id: 'k1',
                kelas_nama: 'XII TKJ 1',
              },
            ],
          });
        }
        if (sql.includes('FROM kelas k')) {
          return Promise.resolve({ rows: [{ '?column?': 1 }], rowCount: 1 }); // hasAccess
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .get('/api/v1/guru/izin/iz1')
        .set('Authorization', `Bearer ${tokenGuru1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('iz1');
      expect(res.body.data.siswa.nama).toBe('Ahmad Fauzi');
    });

    it('gagal 403 jika siswa pengaju izin bukan dari kelas guru', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM guru WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 'g3', user_id: params[0] }] });
        }
        if (sql.includes('FROM izin i')) {
          return Promise.resolve({
            rows: [{ id: 'iz1', kelas_id: 'k1' }],
          });
        }
        if (sql.includes('FROM kelas k')) {
          return Promise.resolve({ rows: [], rowCount: 0 }); // Tidak punya akses
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .get('/api/v1/guru/izin/iz1')
        .set('Authorization', `Bearer ${tokenGuru3}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });

  // ==========================================
  // G-ABS-5: PATCH /api/v1/guru/izin/:id/keputusan
  // ==========================================
  describe('G-ABS-5: PATCH /api/v1/guru/izin/:id/keputusan', () => {
    it('sukses menyetujui izin dan meng-upsert kehadiran absensi dalam satu transaksi', async () => {
      const mockClient = {
        query: vi.fn().mockImplementation((sql: string) => {
          if (sql.includes('UPDATE izin')) {
            return Promise.resolve({
              rows: [
                {
                  id: 'iz1',
                  jenis: 'sakit',
                  tanggal_mulai: '2026-11-12',
                  tanggal_selesai: '2026-11-12',
                  keterangan: 'Demam',
                  status: 'disetujui',
                  catatan: 'Disetujui',
                  dibuat_pada: '2026-11-11T08:30:00Z',
                  diputuskan_pada: '2026-11-11T10:00:00Z',
                },
              ],
            });
          }
          return Promise.resolve({});
        }),
        release: vi.fn(),
      };
      (getClient as any).mockResolvedValue(mockClient);

      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM guru WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 'g1', user_id: params[0] }] });
        }
        if (sql.includes('FROM izin i')) {
          return Promise.resolve({
            rows: [
              {
                id: 'iz1',
                siswa_id: 's1',
                jenis: 'sakit',
                tanggal_mulai: '2026-11-12',
                tanggal_selesai: '2026-11-12',
                status: 'menunggu',
                kelas_id: 'k1',
                siswa_nis: '2324001',
                siswa_nama: 'Ahmad Fauzi',
                kelas_nama: 'XII TKJ 1',
              },
            ],
          });
        }
        if (sql.includes('FROM kelas k')) {
          return Promise.resolve({ rows: [{ '?column?': 1 }], rowCount: 1 });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .patch('/api/v1/guru/izin/iz1/keputusan')
        .set('Authorization', `Bearer ${tokenGuru1}`)
        .send({ status: 'disetujui', catatan: 'Disetujui' });

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('disetujui');
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    });

    it('gagal 422 VALIDATION_ERROR jika status ditolak tanpa catatan', async () => {
      const res = await request(app)
        .patch('/api/v1/guru/izin/iz1/keputusan')
        .set('Authorization', `Bearer ${tokenGuru1}`)
        .send({ status: 'ditolak' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('gagal 422 IZIN_SUDAH_DIPUTUSKAN jika izin sudah berstatus disetujui / ditolak', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM guru WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 'g1', user_id: params[0] }] });
        }
        if (sql.includes('FROM izin i')) {
          return Promise.resolve({
            rows: [{ id: 'iz1', status: 'disetujui', kelas_id: 'k1' }],
          });
        }
        if (sql.includes('FROM kelas k')) {
          return Promise.resolve({ rows: [{ '?column?': 1 }], rowCount: 1 });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .patch('/api/v1/guru/izin/iz1/keputusan')
        .set('Authorization', `Bearer ${tokenGuru1}`)
        .send({ status: 'disetujui' });

      expect(res.status).toBe(422);
      expect(res.body.error.code).toBe('IZIN_SUDAH_DIPUTUSKAN');
    });
  });

  // ==========================================
  // G-KEU-1: GET /api/v1/guru/kelas/:kelasId/tagihan/status
  // ==========================================
  describe('G-KEU-1: GET /api/v1/guru/kelas/:kelasId/tagihan/status', () => {
    it('sukses untuk wali kelas melihat status pembayaran per siswa', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM guru WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 'g1', user_id: params[0] }] });
        }
        if (sql.includes('wali_kelas_id = $2')) {
          return Promise.resolve({ rows: [{ '?column?': 1 }], rowCount: 1 });
        }
        if (sql.includes('SELECT 1 FROM kelas WHERE id = $1')) {
          return Promise.resolve({ rows: [{ '?column?': 1 }], rowCount: 1 });
        }
        if (sql.includes('COUNT(*) AS total FROM siswa')) {
          return Promise.resolve({ rows: [{ total: 2 }] });
        }
        if (sql.includes('COUNT(t.id) FILTER')) {
          return Promise.resolve({
            rows: [
              { siswa_id: 's1', nama: 'Ahmad Fauzi', status: 'Lunas' },
              { siswa_id: 's2', nama: 'Dewi Lestari', status: 'Belum Lunas' },
            ],
          });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .get('/api/v1/guru/kelas/k1/tagihan/status')
        .set('Authorization', `Bearer ${tokenGuru1}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.data[0].status).toBe('Lunas');
      expect(res.body.data[1].status).toBe('Belum Lunas');
    });

    it('gagal 403 bila guru bukan wali kelas (hanya pengajar mata pelajaran)', async () => {
      (query as any).mockImplementation((sql: string, params: any[]) => {
        if (sql.includes('FROM guru WHERE user_id')) {
          return Promise.resolve({ rows: [{ id: 'g2', user_id: params[0] }] });
        }
        if (sql.includes('wali_kelas_id = $2')) {
          return Promise.resolve({ rows: [], rowCount: 0 }); // Bukan wali kelas
        }
        if (sql.includes('SELECT 1 FROM kelas WHERE id = $1')) {
          return Promise.resolve({ rows: [{ '?column?': 1 }], rowCount: 1 });
        }
        return Promise.resolve({ rows: [] });
      });

      const res = await request(app)
        .get('/api/v1/guru/kelas/k1/tagihan/status')
        .set('Authorization', `Bearer ${tokenGuru2}`);

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });
  });
});
