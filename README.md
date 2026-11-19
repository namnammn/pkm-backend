# Backend Web Portal Siswa (REST API v2.0)

Implementasi REST API Backend Web Portal Siswa menggunakan **Node.js**, **Express.js**, **TypeScript**, dan **PostgreSQL (v14+)** yang dibangun dan disinkronkan secara ketat dengan dokumen spesifikasi:
- [`PRD-PKM.md`](./PRD-PKM.md) (PRD v2.0)
- [`api-spec.md`](./api-spec.md) (API Spec v2.0)
- [`ERD.md`](./ERD.md) (ERD & Skema Database v2.0)
- [`DOKUMENTASI-PROJECT.md`](./DOKUMENTASI-PROJECT.md)

---

## 1. Arsitektur & Struktur Folder

Arsitektur aplikasi menerapkan pola 4-lapis (*Separation of Concerns*): **`routes → controllers → services → repositories`**:

```text
PKM/
├── src/
│   ├── config/              # Konfigurasi environment & PostgreSQL connection pool
│   │   ├── index.ts
│   │   └── db.ts
│   ├── controllers/         # Request handling & HTTP response/status code mapping
│   │   ├── pkl.controller.ts
│   │   ├── absensi.controller.ts
│   │   └── keuangan.controller.ts
│   ├── services/            # Aturan bisnis inti, transaksi, & kalkulasi status dinamis
│   │   ├── pkl.service.ts
│   │   ├── absensi.service.ts
│   │   └── keuangan.service.ts
│   ├── repositories/        # Query database PostgreSQL dengan parameterized queries
│   │   ├── pkl.repository.ts
│   │   ├── absensi.repository.ts
│   │   └── keuangan.repository.ts
│   ├── routes/              # Routing Express v1 (/api/v1/siswa & /api/v1/guru)
│   │   ├── siswa.routes.ts
│   │   └── guru.routes.ts
│   ├── middlewares/         # Auth JWT, Role Guard, Zod Validator, Multer & Magic Bytes
│   │   ├── auth.ts
│   │   ├── errorHandler.ts
│   │   ├── upload.ts
│   │   └── validate.ts
│   ├── validations/         # Skema validasi Zod (body, query, params)
│   │   ├── pkl.validation.ts
│   │   ├── absensi.validation.ts
│   │   └── keuangan.validation.ts
│   ├── seeders/             # Runner migrasi schema DDL & seeder data awal
│   │   ├── migrate.ts
│   │   └── seed.ts
│   ├── types/               # TypeScript interfaces & custom types
│   │   └── index.ts
│   ├── utils/               # AppError subclasses & date/progress helper
│   │   ├── errors.ts
│   │   └── date.ts
│   ├── app.ts               # Setup Express application & middlewares
│   └── server.ts            # Entrypoint listener HTTP server
├── tests/                   # Automated tests lengkap (Vitest + Supertest)
│   └── api.test.ts
├── uploads/                 # Direktori penyimpanan berkas unggahan di luar publik
├── schema.sql               # DDL skema PostgreSQL v2.0 (Constraints & Indexes)
├── seed.sql                 # Data seeder master & transaksional
├── Dockerfile               # Multi-stage production Docker build
├── docker-compose.yml       # Orkestrasi container API & PostgreSQL
├── .dockerignore
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

---

## 2. Katalog 19 Endpoint API

Total **19 Endpoint** (9 Endpoint Siswa dan 10 Endpoint Guru):

### 2.1 Endpoint Siswa (Role: `siswa`, Base: `/api/v1/siswa`)

| ID | Method | Path | Deskripsi |
|---|---|---|---|
| `S-PKL-1` | `GET` | `/pkl` | Status PKL (*Belum Dimulai*/*Aktif*/*Selesai*), industri, pembimbing, progres bulan, dan catatan laporan. |
| `S-PKL-2` | `GET` | `/pkl/nilai` | Nilai akhir PKL (sikap, keterampilan, kedisiplinan, nilai akhir). `null` jika belum dinilai. |
| `S-PKL-3` | `POST` | `/pkl/laporan` | Unggah laporan akhir PKL (PDF maks 10 MB). `201` baru, `200` saat status revisi. |
| `S-ABS-1` | `GET` | `/absensi/rekap` | Rekap kehadiran (hadir, izin, sakit, alpa) per `bulan` atau `semester`. |
| `S-ABS-2` | `POST` | `/izin` | Pengajuan surat izin/sakit dengan berkas lampiran (JPG/PNG/PDF maks 5 MB). |
| `S-KEU-1` | `GET` | `/tagihan` | Daftar tagihan siswa dengan filter status (*Lunas*, *Belum Lunas*, *Jatuh Tempo*) dan pagination. |
| `S-KEU-2` | `GET` | `/tagihan/ringkasan` | Total akumulasi nominal seluruh tagihan yang belum lunas. |
| `S-KEU-3` | `GET` | `/info-pembayaran` | Panduan cara bayar, nomor rekening sekolah, dan jadwal loket TU. |
| `S-KEU-4` | `POST` | `/pembayaran` | Unggah bukti transfer (JPG/PNG maks 5 MB). Proteksi tagihan sudah lunas. |

### 2.2 Endpoint Guru (Role: `guru`, Base: `/api/v1/guru`)

| ID | Method | Path | Deskripsi & Hak Akses |
|---|---|---|---|
| `G-PKL-1` | `GET` | `/pkl/siswa` | Daftar siswa bimbingan dan status laporan (**Guru Pembimbing**). |
| `G-PKL-2` | `GET` | `/pkl/laporan/:id` | Detail laporan siswa. Header `Accept: application/pdf` mengalirkan berkas asli (**Guru Pembimbing**). |
| `G-PKL-3` | `PATCH` | `/pkl/laporan/:id/review` | Persetujuan atau permintaan revisi laporan dengan catatan (**Guru Pembimbing**). |
| `G-PKL-4` | `PUT` | `/pkl/siswa/:siswaId/nilai` | Input nilai akhir PKL (upsert). Server menghitung nilai akhir gabungan otomatis (**Guru Pembimbing**). |
| `G-ABS-1` | `GET` | `/kelas/:kelasId/absensi/rekap` | Rekap kehadiran bulanan per siswa di kelas (**Wali Kelas / Guru Pengajar**). |
| `G-ABS-2` | `POST` | `/kelas/:kelasId/absensi` | Input kehadiran harian kelas massal secara atomik (**Wali Kelas / Guru Pengajar**). |
| `G-ABS-3` | `GET` | `/izin` | Daftar pengajuan izin siswa di kelas yang diampu/diajar (**Wali Kelas / Guru Pengajar**). |
| `G-ABS-4` | `GET` | `/izin/:id` | Detail izin siswa dan streaming lampiran berkas (**Wali Kelas / Guru Pengajar**). |
| `G-ABS-5` | `PATCH` | `/izin/:id/keputusan` | Keputusan persetujuan/penolakan izin. Jika disetujui, absensi di-upsert otomatis (**Wali Kelas / Guru Pengajar**). |
| `G-KEU-1` | `GET` | `/kelas/:kelasId/tagihan/status` | Status pembayaran per siswa (*Lunas* / *Belum Lunas*) (**Khusus Wali Kelas**). |

---

## 3. Fitur Keamanan & Kualitas

1. **Role-Based & Relationship-Based Access Control:**
   - Token JWT memvalidasi role `siswa` atau `guru`.
   - Guru pembimbing hanya dapat mengakses siswa bimbingannya.
   - Wali kelas & guru pengajar hanya dapat mengakses kelas yang diampunya.
   - Endpoint keuangan kelas (`G-KEU-1`) dibatasi ketat **hanya untuk wali kelas**.
2. **Pengamanan Berkas Unggahan:**
   - Disimpan di luar folder publik (`uploads/`).
   - Penamaan di-hash acak (`Date.now() + 16-byte random hex + extension`).
   - Pemeriksaan biner **Magic Bytes** menggunakan pustaka `file-type` untuk mencegah spoofing ekstensi file berbahaya.
3. **Kalkulasi Status Dinamis di Server:**
   - Status PKL (*Belum Dimulai*, *Aktif*, *Selesai*), progres bulan, dan status tagihan (*Jatuh Tempo*) dihitung saat request berdasarkan tanggal hari ini, tidak ada data basi tersimpan di DB.
4. **Transaksi Database Atomik:**
   - Multi-tabel update (seperti persetujuan izin yang meng-upsert catatan absensi harian) dibungkus dalam transaksi `BEGIN ... COMMIT / ROLLBACK`.

---

## 4. Panduan Menjalankan Secara Lokal

### 4.1 Prasyarat
- Node.js (v20+ / v22 / v26)
- PostgreSQL (v14+)

### 4.2 Instalasi Dependensi
```bash
npm install
```

### 4.3 Konfigurasi Environment
Salin `.env.example` ke `.env`:
```bash
cp .env.example .env
```
Sesuaikan `DATABASE_URL` dan `JWT_SECRET` pada file `.env`.

### 4.4 Inisialisasi Database (Migrasi & Seeder)
```bash
# Menjalankan migrasi DDL schema:
npm run migrate

# Menjalankan seeder data awal:
npm run seed

# Atau keduanya sekaligus:
npm run db:setup
```

### 4.5 Menjalankan Aplikasi
```bash
# Mode Development (auto-reload via tsx):
npm run dev

# Kompilasi TypeScript ke JavaScript:
npm run build

# Menjalankan server hasil build (Production mode):
npm start
```

### 4.6 Menjalankan Pengujian Otomatis (Testing)
```bash
npm test
```
Seluruh **43 test case** mencakup kasus sukses dan penolakan akses untuk ke-19 endpoint.

---

## 5. Panduan Deployment Produksi

### 5.1 Opsi 1: Menggunakan Docker & Docker Compose (Sangat Direkomendasikan)

Proyek ini telah dilengkapi dengan `Dockerfile` (multi-stage build) dan `docker-compose.yml` yang siap pakai untuk deployment langsung di VPS / Server Cloud (DigitalOcean, AWS EC2, Linode, GCP, dsb).

1. Pastikan Docker dan Docker Compose telah terpasang di server target.
2. Clone repository dan masuk ke direktori proyek:
   ```bash
   git clone <repo-url>
   cd PKM
   ```
3. Sesuaikan variabel di `.env` (terutama `POSTGRES_PASSWORD` dan `JWT_SECRET`).
4. Jalankan seluruh stack (Database PostgreSQL 16 + Express API):
   ```bash
   docker compose up -d --build
   ```
5. Periksa status container:
   ```bash
   docker compose ps
   docker compose logs -f api
   ```
6. Aplikasi langsung aktif di `http://<ip-server>:3000/api/v1` dengan database yang telah termigrasi dan terisi seeder secara otomatis.

### 5.2 Opsi 2: Cloud PaaS (Render, Railway, Fly.io)

1. **Database:**
   - Buat instance PostgreSQL terkelola di platform (misal: Railway / Render PostgreSQL).
   - Salin connection string ke environment variable `DATABASE_URL`.
2. **Web Service:**
   - Hubungkan repository GitHub ke layanan Cloud.
   - Atur Build Command:
     ```bash
     npm ci && npm run build
     ```
   - Atur Start Command:
     ```bash
     npm run migrate && npm start
     ```
   - Atur Environment Variables:
     - `NODE_ENV=production`
     - `PORT=3000`
     - `DATABASE_URL=<connection-string-postgresql>`
     - `JWT_SECRET=<secret-acak-aman>`
     - `UPLOAD_DIR=./uploads`
     - `BOBOT_NILAI_SEKOLAH=40`
     - `BOBOT_NILAI_INDUSTRI=60`
3. Cek endpoint healthcheck:
   ```text
   GET https://your-app-domain.com/health
   ```
   Respon: `{"status":"ok","timestamp":"..."}`
