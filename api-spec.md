# API Spec: Backend Web Portal Siswa

Versi 2.0. Sinkron dengan **PRD v2.0** (ID seperti `S-PKL-1` merujuk ke PRD) dan `schema.sql` (nama field = camelCase dari kolom DB). Total **19 endpoint** (9 siswa, 10 guru).

**Perubahan dari v1:** (1) `GET /guru/izin` ditambahkan sebagai `G-ABS-3`, sehingga detail dan keputusan izin bergeser menjadi `G-ABS-4` dan `G-ABS-5`; (2) `S-PKL-1` kini memuat blok `laporan` agar siswa tahu status dan catatan revisi.

## 1. Konvensi

| Aspek | Ketentuan |
|---|---|
| Base URL | `/api/v1` |
| Auth | `Authorization: Bearer <JWT>`. Token berisi `userId` dan `role` (`siswa` / `guru`). Proses login di luar scope PRD |
| Identitas siswa | Selalu dari token, tidak pernah dari URL atau body |
| Sukses | `{ "data": ... }`. List ditambah `"meta": { "page", "limit", "total" }` |
| Gagal | `{ "error": { "code", "message", "details"? } }` |
| Pagination | `page` (default 1), `limit` (default 20, maksimal 100). Hanya endpoint list |
| Tanggal | `YYYY-MM-DD`. Waktu: ISO 8601 UTC. Bulan: `YYYY-MM` |
| Upload | `multipart/form-data`. PDF maksimal 10 MB, gambar maksimal 5 MB. Validasi MIME dan magic bytes |
| Unduh file | Tidak ada endpoint file terpisah. `G-PKL-2` dan `G-ABS-3` mengalirkan file aslinya bila header `Accept` diset ke tipe file (`application/pdf`, `image/jpeg`, `image/png`). Default JSON |

### Kode status

| Status | Dipakai untuk |
|---|---|
| `200` | Sukses |
| `201` | Data dibuat |
| `400` | Request cacat (JSON rusak, tipe data tidak terbaca) |
| `401` | Token tidak ada, tidak valid, atau kedaluwarsa |
| `403` | Role salah, atau di luar relasi data |
| `404` | Data tidak ditemukan |
| `422` | Validasi field **dan** pelanggaran aturan bisnis. Bedakan lewat `error.code` |
| `500` | Kesalahan server |

### Aturan otorisasi guru

Role saja tidak cukup. Setiap endpoint guru dicek terhadap relasi data, pelanggaran dibalas `403`.

| Jenis akses | Syarat |
|---|---|
| Guru Pembimbing | `penempatan_pkl.guru_pembimbing_id` = guru yang login |
| Kelas (absensi, izin) | Guru adalah `kelas.wali_kelas_id` **atau** ada di `kelas_guru` |
| Kelas (keuangan) | Guru adalah `kelas.wali_kelas_id` saja |

## 2. Ringkasan Endpoint

### Siswa

| ID | Method | Endpoint | Fungsi |
|---|---|---|---|
| S-PKL-1 | GET | `/siswa/pkl` | Status, industri, pembimbing, periode, progres |
| S-PKL-2 | GET | `/siswa/pkl/nilai` | Nilai akhir PKL |
| S-PKL-3 | POST | `/siswa/pkl/laporan` | Upload laporan akhir (PDF) |
| S-ABS-1 | GET | `/siswa/absensi/rekap` | Rekap hadir, izin, sakit, alpa |
| S-ABS-2 | POST | `/siswa/izin` | Upload surat izin |
| S-KEU-1 | GET | `/siswa/tagihan` | Rincian dan status tagihan |
| S-KEU-2 | GET | `/siswa/tagihan/ringkasan` | Total tagihan |
| S-KEU-3 | GET | `/siswa/info-pembayaran` | Instruksi bayar |
| S-KEU-4 | POST | `/siswa/pembayaran` | Upload bukti pembayaran |

### Guru

| ID | Method | Endpoint | Fungsi |
|---|---|---|---|
| G-PKL-1 | GET | `/guru/pkl/siswa` | Daftar siswa bimbingan |
| G-PKL-2 | GET | `/guru/pkl/laporan/:id` | Lihat laporan PKL |
| G-PKL-3 | PATCH | `/guru/pkl/laporan/:id/review` | Catatan dan persetujuan laporan |
| G-PKL-4 | PUT | `/guru/pkl/siswa/:siswaId/nilai` | Input nilai akhir PKL |
| G-ABS-1 | GET | `/guru/kelas/:kelasId/absensi/rekap` | Rekap kehadiran kelas |
| G-ABS-2 | POST | `/guru/kelas/:kelasId/absensi` | Input kehadiran kelas |
| G-ABS-3 | GET | `/guru/izin` | Daftar pengajuan izin |
| G-ABS-4 | GET | `/guru/izin/:id` | Lihat pengajuan izin dan lampiran |
| G-ABS-5 | PATCH | `/guru/izin/:id/keputusan` | Setujui atau tolak izin |
| G-KEU-1 | GET | `/guru/kelas/:kelasId/tagihan/status` | Status pembayaran kelas |

---

## 3. Endpoint Siswa

Role semua endpoint di bagian ini: `siswa`.

### S-PKL-1: GET `/siswa/pkl`

Informasi penempatan dan status PKL.

**Aturan**

- `status` dihitung server dari tanggal hari ini, tidak disimpan: sebelum `mulai` = *Belum Dimulai*, antara `mulai` dan `selesai` = *Aktif*, setelah `selesai` = *Selesai*.
- `progres.totalBulan` = durasi PKL dibulatkan ke atas dalam bulan. `progres.bulanKe` = bulan berjalan mulai dari 1. *Belum Dimulai* = 0, *Selesai* = `totalBulan`.
- `laporan` = status laporan akhir milik siswa: `null` bila belum upload, selain itu `{ status, catatan }`. Dipakai siswa untuk melihat catatan saat status `revisi`.
- Siswa belum punya penempatan: `404 PKL_NOT_FOUND`.

**200**

```json
{
  "data": {
    "status": "Aktif",
    "industri": { "nama": "PT Teknologi Nusantara", "alamat": "Jl. Merdeka No. 10, Tangerang Selatan" },
    "pembimbingIndustri": { "nama": "Budi Santoso", "kontak": "081234567890" },
    "guruPembimbing": { "nama": "Siti Rahma, S.Pd", "kontak": "081298765432" },
    "periode": { "mulai": "2026-09-01", "selesai": "2026-11-30" },
    "progres": { "bulanKe": 3, "totalBulan": 3 },
    "laporan": { "status": "revisi", "catatan": "Bab 3 belum ada dokumentasi kegiatan." }
  }
}
```

**Error:** `401`, `403`, `404`

---

### S-PKL-2: GET `/siswa/pkl/nilai`

Nilai akhir PKL.

**Aturan**

- `sikap`, `keterampilan`, `kedisiplinan` berasal dari industri. `nilaiAkhir` adalah nilai gabungan (sekolah + industri) hasil hitung server saat guru menginput.
- Guru belum menginput nilai: tetap `200` dengan semua nilai `null`, **bukan** error.

**200**

```json
{ "data": { "sikap": 88, "keterampilan": 85.5, "kedisiplinan": 90, "nilaiAkhir": 87.6 } }
```

**200 (belum dinilai)**

```json
{ "data": { "sikap": null, "keterampilan": null, "kedisiplinan": null, "nilaiAkhir": null } }
```

**Error:** `401`, `403`, `404`

---

### S-PKL-3: POST `/siswa/pkl/laporan`

Upload laporan akhir PKL.

**Request** `multipart/form-data`

| Field | Tipe | Wajib | Catatan |
|---|---|---|---|
| `file` | file | ya | Hanya `application/pdf`, maksimal 10 MB |

**Aturan**

- Belum pernah upload: laporan dibuat, status `menunggu`, response `201`.
- Sudah ada dan statusnya `revisi`: file diganti, status kembali `menunggu`, response `200`.
- Sudah ada dengan status `menunggu` atau `disetujui`: `422 LAPORAN_TIDAK_DAPAT_DIUBAH`.
- Siswa belum punya penempatan: `404 PKL_NOT_FOUND`.

**201 / 200**

```json
{ "data": { "id": "b3c1...", "status": "menunggu", "diuploadPada": "2026-11-11T08:30:00Z" } }
```

**Error:** `401`, `403`, `404`, `422` (`FILE_TYPE_INVALID`, `FILE_TOO_LARGE`, `LAPORAN_TIDAK_DAPAT_DIUBAH`)

---

### S-ABS-1: GET `/siswa/absensi/rekap`

Rekap kehadiran.

**Query**

| Param | Format | Contoh |
|---|---|---|
| `bulan` | `YYYY-MM` | `2026-10` |
| `semester` | `{tahunMulai}-{tahunSelesai}-{ganjil\|genap}` | `2026-2027-ganjil` |

**Aturan**

- Wajib mengirim **tepat satu** dari `bulan` atau `semester`. Keduanya atau tidak keduanya = `422 VALIDATION_ERROR`.
- Rentang tanggal semester diambil dari tabel `semester`.

**200**

```json
{ "data": { "hadir": 20, "izin": 1, "sakit": 2, "alpa": 0 } }
```

**Error:** `401`, `403`, `404`, `422`

---

### S-ABS-2: POST `/siswa/izin`

Upload surat izin.

**Request** `multipart/form-data`

| Field | Tipe | Wajib | Catatan |
|---|---|---|---|
| `jenis` | `izin` \| `sakit` | ya | |
| `tanggalMulai` | date | ya | |
| `tanggalSelesai` | date | ya | Tidak boleh lebih awal dari `tanggalMulai` |
| `keterangan` | string | tidak | Maksimal 500 karakter |
| `lampiran` | file | ya | JPG, PNG, atau PDF, maksimal 5 MB |

**Aturan:** status awal selalu `menunggu`. Keputusan hanya bisa diberikan guru.

**201**

```json
{
  "data": {
    "id": "e91a...",
    "jenis": "sakit",
    "tanggalMulai": "2026-11-12",
    "tanggalSelesai": "2026-11-13",
    "keterangan": "Demam, surat dokter terlampir",
    "status": "menunggu",
    "dibuatPada": "2026-11-11T08:30:00Z"
  }
}
```

**Error:** `401`, `403`, `422`

---

### S-KEU-1: GET `/siswa/tagihan`

Rincian dan status tagihan.

**Query:** `status` (`Lunas` \| `Belum Lunas` \| `Jatuh Tempo`), `page`, `limit`

**Aturan.** Status dihitung server, tidak disimpan, dan saling lepas:

| Status | Kondisi |
|---|---|
| `Lunas` | `lunas_pada` terisi |
| `Jatuh Tempo` | belum lunas **dan** `jatuh_tempo` < hari ini |
| `Belum Lunas` | belum lunas dan belum lewat jatuh tempo |

Filter `status=Belum Lunas` **tidak** mencakup yang berstatus `Jatuh Tempo`.

**200**

```json
{
  "data": [
    { "id": "a1f0...", "komponen": "SPP", "keterangan": "SPP November 2026", "nominal": 350000, "jatuhTempo": "2026-11-10", "status": "Jatuh Tempo" },
    { "id": "c7d2...", "komponen": "UKK", "keterangan": null, "nominal": 500000, "jatuhTempo": "2026-12-15", "status": "Belum Lunas" }
  ],
  "meta": { "page": 1, "limit": 20, "total": 2 }
}
```

`komponen`: `SPP` \| `BAHAN_PRAKTIKUM` \| `UKK`.

**Error:** `401`, `403`, `422`

---

### S-KEU-2: GET `/siswa/tagihan/ringkasan`

Total tagihan yang harus dibayar.

**Aturan:** `total` = jumlah `nominal` semua tagihan yang belum lunas, termasuk yang jatuh tempo. Tidak ada tagihan belum lunas = `0`.

**200**

```json
{ "data": { "total": 850000 } }
```

**Error:** `401`, `403`

---

### S-KEU-3: GET `/siswa/info-pembayaran`

Instruksi pembayaran manual. Data dari tabel `info_pembayaran` (satu baris).

**200**

```json
{
  "data": {
    "namaBank": "Bank Contoh",
    "nomorRekening": "1234567890",
    "namaPenerima": "SMK Contoh Nusantara",
    "jadwalLoket": "Senin - Jumat, 08.00 - 14.00 WIB"
  }
}
```

**Error:** `401`, `403`, `404`

---

### S-KEU-4: POST `/siswa/pembayaran`

Upload bukti pembayaran.

**Request** `multipart/form-data`

| Field | Tipe | Wajib | Catatan |
|---|---|---|---|
| `tagihanId` | uuid | ya | |
| `nominal` | number | ya | Lebih dari 0 |
| `tanggalTransfer` | date | ya | |
| `bukti` | file | ya | JPG atau PNG, maksimal 5 MB |

**Aturan**

- Satu bukti untuk satu tagihan.
- Tagihan bukan milik siswa atau tidak ada: `404 TAGIHAN_NOT_FOUND`. Sengaja disamakan agar keberadaan tagihan siswa lain tidak bocor.
- Tagihan sudah lunas: `422 TAGIHAN_SUDAH_LUNAS`.
- Endpoint hanya menyimpan bukti (status `menunggu`). Verifikasi oleh Admin TU di luar scope.

**201**

```json
{
  "data": {
    "id": "f20b...",
    "tagihanId": "a1f0...",
    "nominal": 350000,
    "tanggalTransfer": "2026-11-11",
    "status": "menunggu",
    "diuploadPada": "2026-11-11T09:00:00Z"
  }
}
```

**Error:** `401`, `403`, `404`, `422`

---

## 4. Endpoint Guru

Role semua endpoint di bagian ini: `guru`.

### G-PKL-1: GET `/guru/pkl/siswa`

Daftar siswa bimbingan. Hanya siswa yang `guru_pembimbing_id`-nya guru yang login.

**Query:** `page`, `limit`

**Aturan:** field `laporan` dan `siswaId` ditambahkan agar guru punya ID untuk `G-PKL-2`, `G-PKL-3`, dan `G-PKL-4`. `laporan` bernilai `null` bila siswa belum upload.

**200**

```json
{
  "data": [
    {
      "siswaId": "7f1c...",
      "nis": "2324001",
      "nama": "Ahmad Fauzi",
      "statusPkl": "Aktif",
      "industri": { "nama": "PT Teknologi Nusantara", "alamat": "Jl. Merdeka No. 10, Tangerang Selatan" },
      "pembimbingIndustri": { "nama": "Budi Santoso", "kontak": "081234567890" },
      "laporan": { "id": "b3c1...", "status": "menunggu" }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 8 }
}
```

**Error:** `401`, `403`, `422`

---

### G-PKL-2: GET `/guru/pkl/laporan/:id`

Lihat laporan PKL siswa.

**Aturan**

- Laporan harus milik siswa bimbingan guru ini, selain itu `403`.
- `Accept: application/json` (default): metadata. `Accept: application/pdf`: mengalirkan file PDF.

**200 (JSON)**

```json
{
  "data": {
    "id": "b3c1...",
    "siswa": { "id": "7f1c...", "nis": "2324001", "nama": "Ahmad Fauzi" },
    "namaFile": "laporan-pkl-ahmad.pdf",
    "status": "menunggu",
    "catatan": null,
    "diuploadPada": "2026-11-11T08:30:00Z",
    "diperiksaPada": null
  }
}
```

**Error:** `401`, `403`, `404`

---

### G-PKL-3: PATCH `/guru/pkl/laporan/:id/review`

Beri catatan dan setujui laporan.

**Body**

| Field | Tipe | Wajib | Catatan |
|---|---|---|---|
| `status` | `disetujui` \| `revisi` | ya | |
| `catatan` | string | wajib bila `revisi` | Maksimal 1000 karakter |

**Aturan**

- Laporan harus milik siswa bimbingan guru ini, selain itu `403`.
- Hanya laporan berstatus `menunggu` yang bisa direview. Selain itu `422 LAPORAN_TIDAK_DAPAT_DIREVIEW`.
- `revisi` membuka kesempatan siswa upload ulang lewat `S-PKL-3`.

**Contoh request**

```json
{ "status": "revisi", "catatan": "Bab 3 belum ada dokumentasi kegiatan." }
```

**200:** objek laporan seperti `G-PKL-2` dengan `status`, `catatan`, dan `diperiksaPada` terbarui.

**Error:** `400`, `401`, `403`, `404`, `422`

---

### G-PKL-4: PUT `/guru/pkl/siswa/:siswaId/nilai`

Input nilai akhir PKL.

**Body**

```json
{
  "nilaiSekolah": 85,
  "nilaiIndustri": { "sikap": 88, "keterampilan": 85.5, "kedisiplinan": 90 }
}
```

**Aturan**

- Siswa harus bimbingan guru ini, selain itu `403`.
- Semua nilai rentang 0 sampai 100.
- `nilaiAkhir` dihitung server dari `nilaiSekolah` dan rata-rata `nilaiIndustri` menurut bobot di config aplikasi. Client **tidak** mengirim `nilaiAkhir`. Bobot belum final (PRD Bagian 10, no. 1).
- `PUT` bersifat upsert: pertama kali membuat, berikutnya menimpa.

**200**

```json
{
  "data": {
    "siswaId": "7f1c...",
    "nilaiSekolah": 85,
    "nilaiIndustri": { "sikap": 88, "keterampilan": 85.5, "kedisiplinan": 90 },
    "nilaiAkhir": 87.6
  }
}
```

**Error:** `400`, `401`, `403`, `404`, `422`

---

### G-ABS-1: GET `/guru/kelas/:kelasId/absensi/rekap`

Rekap kehadiran kelas.

**Query:** `bulan` (wajib, `YYYY-MM`), `page`, `limit`

**Aturan:** guru harus wali kelas atau pengajar kelas ini, selain itu `403`. Satu baris per siswa, diurutkan menurut nama.

**200**

```json
{
  "data": [
    { "siswaId": "7f1c...", "nis": "2324001", "nama": "Ahmad Fauzi", "hadir": 20, "izin": 1, "sakit": 2, "alpa": 0 }
  ],
  "meta": { "page": 1, "limit": 20, "total": 32 }
}
```

**Error:** `401`, `403`, `404`, `422`

---

### G-ABS-2: POST `/guru/kelas/:kelasId/absensi`

Input kehadiran kelas.

**Body**

| Field | Tipe | Wajib | Catatan |
|---|---|---|---|
| `tanggal` | date | ya | Tidak boleh di masa depan |
| `data[]` | array | ya | Minimal 1 item |
| `data[].siswaId` | uuid | ya | |
| `data[].status` | `hadir` \| `izin` \| `sakit` \| `alpa` | ya | |

```json
{
  "tanggal": "2026-11-10",
  "data": [
    { "siswaId": "7f1c...", "status": "hadir" },
    { "siswaId": "0a9b...", "status": "alpa" }
  ]
}
```

**Aturan**

- Guru harus wali kelas atau pengajar kelas ini, selain itu `403`.
- Satu siswa hanya punya satu record per tanggal (`UNIQUE siswa_id, tanggal`).
- Bersifat **upsert**: bila record tanggal itu sudah ada, statusnya ditimpa. Ini sekaligus jalur koreksi.
- Semua `siswaId` harus anggota kelas ini (`422 SISWA_BUKAN_ANGGOTA_KELAS`) dan tidak boleh ganda dalam satu request (`422 SISWA_DUPLIKAT`).
- Request atomik: gagal satu = gagal semua.

**201**

```json
{ "data": { "tanggal": "2026-11-10", "tersimpan": 2 } }
```

**Error:** `400`, `401`, `403`, `404`, `422`

---

### G-ABS-3: GET `/guru/izin`

Daftar pengajuan izin dari siswa di kelas yang diampu atau diajar guru ini. Turunan langsung dari fitur "melihat pengajuan surat izin/sakit": tanpa daftar, guru tidak punya ID untuk membuka detail.

**Query**

| Param | Tipe | Catatan |
|---|---|---|
| `status` | `menunggu` \| `disetujui` \| `ditolak` | Opsional. Tanpa filter = semua |
| `kelasId` | uuid | Opsional. Harus kelas yang diampu atau diajar guru ini, selain itu `403` |
| `page`, `limit` | integer | Pagination |

**Aturan:** hanya izin milik siswa di kelas yang guru ini wali kelas atau pengajarnya. Urutan: `dibuatPada` terbaru dulu.

**200**

```json
{
  "data": [
    {
      "id": "e91a...",
      "siswa": { "id": "7f1c...", "nis": "2324001", "nama": "Ahmad Fauzi", "kelas": "XII TKJ 1" },
      "jenis": "sakit",
      "tanggalMulai": "2026-11-12",
      "tanggalSelesai": "2026-11-13",
      "status": "menunggu",
      "dibuatPada": "2026-11-11T08:30:00Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 3 }
}
```

**Error:** `401`, `403`, `422`

---

### G-ABS-4: GET `/guru/izin/:id`

Lihat pengajuan izin beserta lampiran.

**Aturan**

- Guru harus wali kelas atau pengajar dari kelas siswa pengaju, selain itu `403`.
- `Accept: application/json` (default): detail. `Accept: image/jpeg`, `image/png`, atau `application/pdf`: mengalirkan file lampiran.
- `id` didapat dari `G-ABS-3`.

**200 (JSON)**

```json
{
  "data": {
    "id": "e91a...",
    "siswa": { "id": "7f1c...", "nis": "2324001", "nama": "Ahmad Fauzi", "kelas": "XII TKJ 1" },
    "jenis": "sakit",
    "tanggalMulai": "2026-11-12",
    "tanggalSelesai": "2026-11-13",
    "keterangan": "Demam, surat dokter terlampir",
    "status": "menunggu",
    "catatan": null,
    "dibuatPada": "2026-11-11T08:30:00Z",
    "diputuskanPada": null
  }
}
```

**Error:** `401`, `403`, `404`

---

### G-ABS-5: PATCH `/guru/izin/:id/keputusan`

Setujui atau tolak izin.

**Body**

| Field | Tipe | Wajib | Catatan |
|---|---|---|---|
| `status` | `disetujui` \| `ditolak` | ya | |
| `catatan` | string | wajib bila `ditolak` | Maksimal 1000 karakter |

**Aturan**

- Otorisasi sama seperti `G-ABS-4`.
- Izin yang sudah diputuskan tidak bisa diputuskan ulang: `422 IZIN_SUDAH_DIPUTUSKAN`.
- **Efek samping saat `disetujui`** (satu transaksi): untuk setiap tanggal pada rentang izin, record `absensi` di-upsert dengan status `izin` atau `sakit` sesuai `jenis`, dan `absensi.izin_id` diisi.

**200:** objek izin seperti `G-ABS-4` dengan `status`, `catatan`, dan `diputuskanPada` terbarui.

**Error:** `400`, `401`, `403`, `404`, `422`

---

### G-KEU-1: GET `/guru/kelas/:kelasId/tagihan/status`

Status pembayaran siswa di kelas. Read-only.

**Query:** `page`, `limit`

**Aturan.** Hanya **wali kelas** kelas ini (pengajar biasa = `403`). Status per siswa:

| Status | Kondisi |
|---|---|
| `Lunas` | Semua tagihan siswa lunas, atau siswa tidak punya tagihan |
| `Belum Lunas` | Minimal satu tagihan belum lunas, termasuk yang sudah jatuh tempo |

Sengaja tidak menampilkan rincian tagihan, nominal, bukti, atau data rekening.

**200**

```json
{
  "data": [
    { "siswaId": "7f1c...", "nama": "Ahmad Fauzi", "status": "Lunas" },
    { "siswaId": "0a9b...", "nama": "Dewi Lestari", "status": "Belum Lunas" }
  ],
  "meta": { "page": 1, "limit": 20, "total": 2 }
}
```

**Error:** `401`, `403`, `404`, `422`

---

## 5. Daftar Kode Error

Format: `{ "error": { "code": "...", "message": "...", "details": [...] } }`. `details` hanya untuk `VALIDATION_ERROR`.

| HTTP | `code` | Kapan muncul |
|---|---|---|
| 400 | `BAD_REQUEST` | JSON rusak atau tipe data tidak terbaca |
| 401 | `UNAUTHORIZED` | Token tidak ada, tidak valid, atau kedaluwarsa |
| 403 | `FORBIDDEN` | Role salah, atau di luar relasi data |
| 404 | `NOT_FOUND` | Data tidak ditemukan |
| 404 | `PKL_NOT_FOUND` | Siswa belum punya penempatan PKL |
| 404 | `TAGIHAN_NOT_FOUND` | Tagihan tidak ada atau bukan milik siswa |
| 422 | `VALIDATION_ERROR` | Field tidak valid, atau kombinasi query salah |
| 422 | `FILE_TYPE_INVALID` | MIME atau magic bytes tidak sesuai |
| 422 | `FILE_TOO_LARGE` | Melebihi 10 MB (PDF) atau 5 MB (gambar) |
| 422 | `LAPORAN_TIDAK_DAPAT_DIUBAH` | Upload laporan saat status bukan `revisi` |
| 422 | `LAPORAN_TIDAK_DAPAT_DIREVIEW` | Review laporan yang statusnya bukan `menunggu` |
| 422 | `IZIN_SUDAH_DIPUTUSKAN` | Memutuskan izin yang sudah diputuskan |
| 422 | `TAGIHAN_SUDAH_LUNAS` | Upload bukti untuk tagihan yang sudah lunas |
| 422 | `SISWA_BUKAN_ANGGOTA_KELAS` | `siswaId` di input absensi bukan anggota kelas |
| 422 | `SISWA_DUPLIKAT` | `siswaId` ganda dalam satu request absensi |
| 500 | `INTERNAL_ERROR` | Kesalahan server tak terduga |

**Contoh `VALIDATION_ERROR`**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validasi gagal",
    "details": [
      { "field": "tanggalSelesai", "message": "Tidak boleh lebih awal dari tanggalMulai" }
    ]
  }
}
```

## 6. Keputusan Tambahan di Luar PRD

| Keputusan | Alasan |
|---|---|
| Lampiran diunduh lewat header `Accept` di `G-PKL-2` dan `G-ABS-3` | Tidak menambah endpoint, tapi guru tetap bisa melihat file |
| `G-PKL-1` memuat `siswaId` dan `laporan {id, status}` | Guru butuh ID untuk `G-PKL-2`, `G-PKL-3`, `G-PKL-4` |
| `S-PKL-1` memuat `laporan {status, catatan}` | Siswa harus bisa melihat catatan revisi supaya upload ulang masuk akal |
| `GET /guru/izin` (`G-ABS-3`) ditambahkan | Syarat agar fitur "melihat pengajuan izin" bisa dipakai. Satu-satunya endpoint baru di v2 |
| `S-PKL-3`: `201` saat baru, `200` saat mengganti file revisi | Menjawab pertanyaan terbuka PRD no. 3 tanpa endpoint baru |
| `G-ABS-2` bersifat upsert | Tidak ada endpoint koreksi, ini jalurnya |
| Laporan hanya bisa direview saat `menunggu` | Aturan tambahan, PRD tidak menyebut |
| Pelanggaran aturan bisnis memakai `422` | PRD tidak mengizinkan `409` |
| Pagination hanya di `S-KEU-1`, `G-PKL-1`, `G-ABS-1`, `G-KEU-1` | Hanya endpoint list |

**Masih terbuka:** siswa belum punya cara melihat riwayat izin dan riwayat bukti pembayarannya sendiri, karena tidak ada di daftar fitur. Lihat PRD v2 Bagian 13.
