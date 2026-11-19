-- Schema DDL: Backend Web Portal Siswa
-- Database: PostgreSQL 14+
-- Versi 2.0 (Sinkron dengan PRD v2.0, ERD v2.0, API-Spec v2.0)

-- 1. Extensi UUID (jika belum aktif)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tipe Data Enum
DO $$ BEGIN
    CREATE TYPE role_user AS ENUM ('siswa', 'guru');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE jenis_semester AS ENUM ('ganjil', 'genap');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE status_laporan AS ENUM ('menunggu', 'disetujui', 'revisi');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE status_absensi AS ENUM ('hadir', 'izin', 'sakit', 'alpa');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE jenis_izin AS ENUM ('izin', 'sakit');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE status_izin AS ENUM ('menunggu', 'disetujui', 'ditolak');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE komponen_tagihan AS ENUM ('SPP', 'BAHAN_PRAKTIKUM', 'UKK');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE status_pembayaran AS ENUM ('menunggu', 'diverifikasi', 'ditolak');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Tabel Users & Profile
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role role_user NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS guru (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nip VARCHAR(30) UNIQUE NOT NULL,
    nama VARCHAR(100) NOT NULL,
    kontak VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kelas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama VARCHAR(50) NOT NULL,
    tahun_ajaran VARCHAR(20) NOT NULL,
    wali_kelas_id UUID NOT NULL REFERENCES guru(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS kelas_guru (
    kelas_id UUID NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
    guru_id UUID NOT NULL REFERENCES guru(id) ON DELETE CASCADE,
    PRIMARY KEY (kelas_id, guru_id)
);

CREATE TABLE IF NOT EXISTS siswa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nis VARCHAR(30) UNIQUE NOT NULL,
    nama VARCHAR(100) NOT NULL,
    kelas_id UUID NOT NULL REFERENCES kelas(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS semester (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tahun_ajaran VARCHAR(20) NOT NULL,
    nama jenis_semester NOT NULL,
    tanggal_mulai DATE NOT NULL,
    tanggal_selesai DATE NOT NULL,
    CONSTRAINT chk_semester_tanggal CHECK (tanggal_selesai >= tanggal_mulai)
);

-- 4. Tabel PKL
CREATE TABLE IF NOT EXISTS dudi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nama VARCHAR(150) NOT NULL,
    alamat TEXT NOT NULL,
    nama_pembimbing VARCHAR(100),
    kontak_pembimbing VARCHAR(50),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pembimbing_industri (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dudi_id UUID NOT NULL REFERENCES dudi(id) ON DELETE CASCADE,
    nama VARCHAR(100) NOT NULL,
    kontak VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_pembimbing_dudi UNIQUE (id, dudi_id)
);

CREATE TABLE IF NOT EXISTS penempatan_pkl (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    siswa_id UUID UNIQUE NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
    dudi_id UUID NOT NULL REFERENCES dudi(id) ON DELETE RESTRICT,
    pembimbing_industri_id UUID,
    guru_pembimbing_id UUID NOT NULL REFERENCES guru(id) ON DELETE RESTRICT,
    tanggal_mulai DATE NOT NULL,
    tanggal_selesai DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_penempatan_tanggal CHECK (tanggal_selesai >= tanggal_mulai),
    CONSTRAINT fk_penempatan_pembimbing FOREIGN KEY (pembimbing_industri_id, dudi_id)
        REFERENCES pembimbing_industri(id, dudi_id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS laporan_pkl (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    penempatan_id UUID UNIQUE NOT NULL REFERENCES penempatan_pkl(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    status status_laporan NOT NULL DEFAULT 'menunggu',
    catatan TEXT,
    diperiksa_oleh UUID REFERENCES guru(id) ON DELETE SET NULL,
    diupload_pada TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    diperiksa_pada TIMESTAMPTZ,
    CONSTRAINT chk_laporan_status_diperiksa CHECK ((status = 'menunggu') = (diperiksa_pada IS NULL)),
    CONSTRAINT chk_laporan_revisi_catatan CHECK (status <> 'revisi' OR catatan IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS nilai_pkl (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    penempatan_id UUID UNIQUE NOT NULL REFERENCES penempatan_pkl(id) ON DELETE CASCADE,
    nilai_sikap NUMERIC(5,2) NOT NULL CHECK (nilai_sikap >= 0 AND nilai_sikap <= 100),
    nilai_keterampilan NUMERIC(5,2) NOT NULL CHECK (nilai_keterampilan >= 0 AND nilai_keterampilan <= 100),
    nilai_kedisiplinan NUMERIC(5,2) NOT NULL CHECK (nilai_kedisiplinan >= 0 AND nilai_kedisiplinan <= 100),
    nilai_sekolah NUMERIC(5,2) NOT NULL CHECK (nilai_sekolah >= 0 AND nilai_sekolah <= 100),
    nilai_akhir NUMERIC(5,2) NOT NULL CHECK (nilai_akhir >= 0 AND nilai_akhir <= 100),
    diinput_oleh UUID NOT NULL REFERENCES guru(id) ON DELETE RESTRICT,
    diinput_pada TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Tabel Izin & Absensi
CREATE TABLE IF NOT EXISTS izin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    siswa_id UUID NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
    jenis jenis_izin NOT NULL,
    tanggal_mulai DATE NOT NULL,
    tanggal_selesai DATE NOT NULL,
    lampiran_path TEXT NOT NULL,
    keterangan TEXT,
    status status_izin NOT NULL DEFAULT 'menunggu',
    catatan TEXT,
    diputuskan_oleh UUID REFERENCES guru(id) ON DELETE SET NULL,
    dibuat_pada TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    diputuskan_pada TIMESTAMPTZ,
    CONSTRAINT chk_izin_tanggal CHECK (tanggal_selesai >= tanggal_mulai),
    CONSTRAINT chk_izin_status_diputuskan CHECK ((status = 'menunggu') = (diputuskan_pada IS NULL)),
    CONSTRAINT chk_izin_ditolak_catatan CHECK (status <> 'ditolak' OR catatan IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS absensi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    siswa_id UUID NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
    tanggal DATE NOT NULL,
    status status_absensi NOT NULL,
    izin_id UUID REFERENCES izin(id) ON DELETE SET NULL,
    dicatat_oleh UUID REFERENCES guru(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_absensi_siswa_tanggal UNIQUE (siswa_id, tanggal),
    CONSTRAINT chk_absensi_izin_status CHECK (izin_id IS NULL OR status IN ('izin', 'sakit'))
);

-- 6. Tabel Keuangan
CREATE TABLE IF NOT EXISTS tagihan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    siswa_id UUID NOT NULL REFERENCES siswa(id) ON DELETE CASCADE,
    komponen komponen_tagihan NOT NULL,
    keterangan TEXT,
    nominal NUMERIC(12,2) NOT NULL CHECK (nominal >= 0),
    jatuh_tempo DATE NOT NULL,
    lunas_pada TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pembayaran (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tagihan_id UUID NOT NULL REFERENCES tagihan(id) ON DELETE RESTRICT,
    nominal NUMERIC(12,2) NOT NULL CHECK (nominal > 0),
    tanggal_transfer DATE NOT NULL,
    bukti_path TEXT NOT NULL,
    status status_pembayaran NOT NULL DEFAULT 'menunggu',
    diupload_pada TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS info_pembayaran (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    nama_bank VARCHAR(100) NOT NULL,
    nomor_rekening VARCHAR(50) NOT NULL,
    nama_penerima VARCHAR(150) NOT NULL,
    jadwal_loket TEXT NOT NULL
);

-- 7. Indexes untuk Optimasi Query
CREATE INDEX IF NOT EXISTS idx_siswa_kelas ON siswa(kelas_id);
CREATE INDEX IF NOT EXISTS idx_siswa_user ON siswa(user_id);
CREATE INDEX IF NOT EXISTS idx_guru_user ON guru(user_id);
CREATE INDEX IF NOT EXISTS idx_kelas_wali ON kelas(wali_kelas_id);
CREATE INDEX IF NOT EXISTS idx_kelas_guru_guru ON kelas_guru(guru_id);
CREATE INDEX IF NOT EXISTS idx_penempatan_guru ON penempatan_pkl(guru_pembimbing_id);
CREATE INDEX IF NOT EXISTS idx_penempatan_siswa ON penempatan_pkl(siswa_id);
CREATE INDEX IF NOT EXISTS idx_absensi_siswa_tgl ON absensi(siswa_id, tanggal);
CREATE INDEX IF NOT EXISTS idx_izin_siswa ON izin(siswa_id);
CREATE INDEX IF NOT EXISTS idx_izin_status_dibuat ON izin(status, dibuat_pada DESC);
CREATE INDEX IF NOT EXISTS idx_tagihan_composite ON tagihan(siswa_id, lunas_pada, jatuh_tempo);
CREATE INDEX IF NOT EXISTS idx_pembayaran_tagihan ON pembayaran(tagihan_id);
