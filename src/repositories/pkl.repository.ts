import { query } from '../config/db.js';

export class PklRepository {
  async getSiswaByUserId(userId: string) {
    const res = await query(
      `SELECT id, user_id, nis, nama, kelas_id FROM siswa WHERE user_id = $1`,
      [userId]
    );
    return res.rows[0] || null;
  }

  async getGuruByUserId(userId: string) {
    const res = await query(
      `SELECT id, user_id, nip, nama, kontak FROM guru WHERE user_id = $1`,
      [userId]
    );
    return res.rows[0] || null;
  }

  async getPenempatanBySiswaId(siswaId: string) {
    const res = await query(
      `SELECT 
        p.id,
        p.siswa_id,
        p.dudi_id,
        p.guru_pembimbing_id,
        TO_CHAR(p.tanggal_mulai, 'YYYY-MM-DD') AS tanggal_mulai,
        TO_CHAR(p.tanggal_selesai, 'YYYY-MM-DD') AS tanggal_selesai,
        d.nama AS dudi_nama,
        d.alamat AS dudi_alamat,
        COALESCE(pi.nama, d.nama_pembimbing) AS dudi_pembimbing_nama,
        COALESCE(pi.kontak, d.kontak_pembimbing) AS dudi_pembimbing_kontak,
        g.nama AS guru_nama,
        g.kontak AS guru_kontak,
        l.status AS laporan_status,
        l.catatan AS laporan_catatan
      FROM penempatan_pkl p
      JOIN dudi d ON d.id = p.dudi_id
      LEFT JOIN pembimbing_industri pi ON pi.id = p.pembimbing_industri_id
      JOIN guru g ON g.id = p.guru_pembimbing_id
      LEFT JOIN laporan_pkl l ON l.penempatan_id = p.id
      WHERE p.siswa_id = $1`,
      [siswaId]
    );
    return res.rows[0] || null;
  }

  async getNilaiByPenempatanId(penempatanId: string) {
    const res = await query(
      `SELECT 
        id,
        penempatan_id,
        nilai_sikap::float AS nilai_sikap,
        nilai_keterampilan::float AS nilai_keterampilan,
        nilai_kedisiplinan::float AS nilai_kedisiplinan,
        nilai_sekolah::float AS nilai_sekolah,
        nilai_akhir::float AS nilai_akhir
      FROM nilai_pkl
      WHERE penempatan_id = $1`,
      [penempatanId]
    );
    return res.rows[0] || null;
  }

  async getLaporanByPenempatanId(penempatanId: string) {
    const res = await query(
      `SELECT id, penempatan_id, file_path, status, catatan, diupload_pada, diperiksa_pada
       FROM laporan_pkl
       WHERE penempatan_id = $1`,
      [penempatanId]
    );
    return res.rows[0] || null;
  }

  async createLaporan(penempatanId: string, filePath: string) {
    const res = await query(
      `INSERT INTO laporan_pkl (penempatan_id, file_path, status, diupload_pada)
       VALUES ($1, $2, 'menunggu', CURRENT_TIMESTAMP)
       RETURNING id, status, diupload_pada`,
      [penempatanId, filePath]
    );
    return res.rows[0];
  }

  async updateLaporanFile(id: string, filePath: string) {
    const res = await query(
      `UPDATE laporan_pkl 
       SET file_path = $1, status = 'menunggu', catatan = NULL, diperiksa_oleh = NULL, diperiksa_pada = NULL, diupload_pada = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING id, status, diupload_pada`,
      [filePath, id]
    );
    return res.rows[0];
  }

  async getSiswaBimbingan(guruId: string, page: number, limit: number) {
    const offset = (page - 1) * limit;

    const countRes = await query(
      `SELECT COUNT(*) AS total
       FROM penempatan_pkl p
       WHERE p.guru_pembimbing_id = $1`,
      [guruId]
    );
    const total = parseInt(countRes.rows[0].total, 10);

    const rowsRes = await query(
      `SELECT 
        s.id AS siswa_id,
        s.nis,
        s.nama AS siswa_nama,
        TO_CHAR(p.tanggal_mulai, 'YYYY-MM-DD') AS tanggal_mulai,
        TO_CHAR(p.tanggal_selesai, 'YYYY-MM-DD') AS tanggal_selesai,
        d.nama AS dudi_nama,
        d.alamat AS dudi_alamat,
        COALESCE(pi.nama, d.nama_pembimbing) AS dudi_pembimbing_nama,
        COALESCE(pi.kontak, d.kontak_pembimbing) AS dudi_pembimbing_kontak,
        l.id AS laporan_id,
        l.status AS laporan_status
      FROM penempatan_pkl p
      JOIN siswa s ON s.id = p.siswa_id
      JOIN dudi d ON d.id = p.dudi_id
      LEFT JOIN pembimbing_industri pi ON pi.id = p.pembimbing_industri_id
      LEFT JOIN laporan_pkl l ON l.penempatan_id = p.id
      WHERE p.guru_pembimbing_id = $1
      ORDER BY s.nama ASC
      LIMIT $2 OFFSET $3`,
      [guruId, limit, offset]
    );

    return { rows: rowsRes.rows, total };
  }

  async getLaporanById(laporanId: string) {
    const res = await query(
      `SELECT 
        l.id,
        l.file_path,
        l.status,
        l.catatan,
        l.diupload_pada,
        l.diperiksa_pada,
        p.guru_pembimbing_id,
        s.id AS siswa_id,
        s.nis AS siswa_nis,
        s.nama AS siswa_nama
      FROM laporan_pkl l
      JOIN penempatan_pkl p ON p.id = l.penempatan_id
      JOIN siswa s ON s.id = p.siswa_id
      WHERE l.id = $1`,
      [laporanId]
    );
    return res.rows[0] || null;
  }

  async updateLaporanReview(laporanId: string, status: string, catatan: string | null, guruId: string) {
    const res = await query(
      `UPDATE laporan_pkl
       SET status = $1, catatan = $2, diperiksa_oleh = $3, diperiksa_pada = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, status, catatan, diupload_pada, diperiksa_pada`,
      [status, catatan, guruId, laporanId]
    );
    return res.rows[0];
  }

  async checkPenempatanGuru(siswaId: string, guruId: string) {
    const res = await query(
      `SELECT id FROM penempatan_pkl
       WHERE siswa_id = $1 AND guru_pembimbing_id = $2`,
      [siswaId, guruId]
    );
    return res.rows[0] || null;
  }

  async upsertNilaiPkl(
    penempatanId: string,
    nilaiSekolah: number,
    sikap: number,
    keterampilan: number,
    kedisiplinan: number,
    nilaiAkhir: number,
    guruId: string
  ) {
    const res = await query(
      `INSERT INTO nilai_pkl 
        (penempatan_id, nilai_sekolah, nilai_sikap, nilai_keterampilan, nilai_kedisiplinan, nilai_akhir, diinput_oleh, diinput_pada)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       ON CONFLICT (penempatan_id) DO UPDATE SET
        nilai_sekolah = EXCLUDED.nilai_sekolah,
        nilai_sikap = EXCLUDED.nilai_sikap,
        nilai_keterampilan = EXCLUDED.nilai_keterampilan,
        nilai_kedisiplinan = EXCLUDED.nilai_kedisiplinan,
        nilai_akhir = EXCLUDED.nilai_akhir,
        diinput_oleh = EXCLUDED.diinput_oleh,
        diinput_pada = CURRENT_TIMESTAMP
       RETURNING 
        nilai_sekolah::float AS nilai_sekolah,
        nilai_sikap::float AS nilai_sikap,
        nilai_keterampilan::float AS nilai_keterampilan,
        nilai_kedisiplinan::float AS nilai_kedisiplinan,
        nilai_akhir::float AS nilai_akhir`,
      [penempatanId, nilaiSekolah, sikap, keterampilan, kedisiplinan, nilaiAkhir, guruId]
    );
    return res.rows[0];
  }
}

export const pklRepository = new PklRepository();
