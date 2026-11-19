-- Seeder Data: Backend Web Portal Siswa
-- Sinkron dengan ERD v2.0 dan Schema v2.0

-- 1. Bersihkan Data Sebelumnya (Opsional / Idempoten)
TRUNCATE TABLE 
  pembayaran,
  tagihan,
  absensi,
  izin,
  nilai_pkl,
  laporan_pkl,
  penempatan_pkl,
  pembimbing_industri,
  dudi,
  semester,
  siswa,
  kelas_guru,
  kelas,
  guru,
  users,
  info_pembayaran
CASCADE;

-- 2. Users (Password default: 'password123' bcrypt hash)
-- Hash untuk 'password123': $2b$10$w8gZ9YhV5qM03k6dZ6qKSeL3pXwV0uE.1fX3w6o9x.3sK5f0e.8Ce
INSERT INTO users (id, username, password_hash, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'siswa1', '$2b$10$w8gZ9YhV5qM03k6dZ6qKSeL3pXwV0uE.1fX3w6o9x.3sK5f0e.8Ce', 'siswa'),
  ('22222222-2222-2222-2222-222222222222', 'siswa2', '$2b$10$w8gZ9YhV5qM03k6dZ6qKSeL3pXwV0uE.1fX3w6o9x.3sK5f0e.8Ce', 'siswa'),
  ('33333333-3333-3333-3333-333333333333', 'guru1',  '$2b$10$w8gZ9YhV5qM03k6dZ6qKSeL3pXwV0uE.1fX3w6o9x.3sK5f0e.8Ce', 'guru'),
  ('44444444-4444-4444-4444-444444444444', 'guru2',  '$2b$10$w8gZ9YhV5qM03k6dZ6qKSeL3pXwV0uE.1fX3w6o9x.3sK5f0e.8Ce', 'guru'),
  ('55555555-5555-5555-5555-555555555555', 'guru3',  '$2b$10$w8gZ9YhV5qM03k6dZ6qKSeL3pXwV0uE.1fX3w6o9x.3sK5f0e.8Ce', 'guru')
ON CONFLICT (id) DO NOTHING;

-- 3. Guru
INSERT INTO guru (id, user_id, nip, nama, kontak) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', '198001012005012001', 'Siti Rahma, S.Pd', '081298765432'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '44444444-4444-4444-4444-444444444444', '198202022006021002', 'Joko Purwanto, M.Kom', '081233445566'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '55555555-5555-5555-5555-555555555555', '198503032007031003', 'Hendra Pratama, S.T', '081277889900')
ON CONFLICT (id) DO NOTHING;

-- 4. Kelas & Pengajar
INSERT INTO kelas (id, nama, tahun_ajaran, wali_kelas_id) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'XII TKJ 1', '2026/2027', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
ON CONFLICT (id) DO NOTHING;

INSERT INTO kelas_guru (kelas_id, guru_id) VALUES
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
ON CONFLICT (kelas_id, guru_id) DO NOTHING;

-- 5. Siswa
INSERT INTO siswa (id, user_id, nis, nama, kelas_id) VALUES
  ('7f1c0000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', '2324001', 'Ahmad Fauzi', 'dddddddd-dddd-dddd-dddd-dddddddddddd'),
  ('0a9b0000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', '2324002', 'Dewi Lestari', 'dddddddd-dddd-dddd-dddd-dddddddddddd')
ON CONFLICT (id) DO NOTHING;

-- 6. Semester
INSERT INTO semester (id, tahun_ajaran, nama, tanggal_mulai, tanggal_selesai) VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '2026/2027', 'ganjil', '2026-07-01', '2026-12-31')
ON CONFLICT (id) DO NOTHING;

-- 7. DUDI, Pembimbing Industri, & Penempatan PKL
INSERT INTO dudi (id, nama, alamat, nama_pembimbing, kontak_pembimbing) VALUES
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', 'PT Teknologi Nusantara', 'Jl. Merdeka No. 10, Tangerang Selatan', 'Budi Santoso', '081234567890')
ON CONFLICT (id) DO NOTHING;

INSERT INTO pembimbing_industri (id, dudi_id, nama, kontak) VALUES
  ('99999999-9999-9999-9999-999999999999', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'Budi Santoso', '081234567890')
ON CONFLICT (id, dudi_id) DO NOTHING;

INSERT INTO penempatan_pkl (id, siswa_id, dudi_id, pembimbing_industri_id, guru_pembimbing_id, tanggal_mulai, tanggal_selesai) VALUES
  ('12345678-1234-1234-1234-1234567890ab', '7f1c0000-0000-0000-0000-000000000001', 'ffffffff-ffff-ffff-ffff-ffffffffffff', '99999999-9999-9999-9999-999999999999', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-09-01', '2026-11-30')
ON CONFLICT (id) DO NOTHING;

-- 8. Info Pembayaran
INSERT INTO info_pembayaran (id, nama_bank, nomor_rekening, nama_penerima, jadwal_loket) VALUES
  (1, 'Bank Contoh', '1234567890', 'SMK Contoh Nusantara', 'Senin - Jumat, 08.00 - 14.00 WIB')
ON CONFLICT (id) DO UPDATE SET
  nama_bank = EXCLUDED.nama_bank,
  nomor_rekening = EXCLUDED.nomor_rekening,
  nama_penerima = EXCLUDED.nama_penerima,
  jadwal_loket = EXCLUDED.jadwal_loket;

-- 9. Tagihan
INSERT INTO tagihan (id, siswa_id, komponen, keterangan, nominal, jatuh_tempo, lunas_pada) VALUES
  ('a1f00000-0000-0000-0000-000000000001', '7f1c0000-0000-0000-0000-000000000001', 'SPP', 'SPP November 2026', 350000, '2026-11-10', NULL),
  ('c7d20000-0000-0000-0000-000000000002', '7f1c0000-0000-0000-0000-000000000001', 'UKK', NULL, 500000, '2026-12-15', NULL),
  ('d8e30000-0000-0000-0000-000000000003', '0a9b0000-0000-0000-0000-000000000002', 'SPP', 'SPP November 2026', 350000, '2026-11-10', '2026-11-05 10:00:00+00')
ON CONFLICT (id) DO NOTHING;
