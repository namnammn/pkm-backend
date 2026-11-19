import { query } from '../config/db.js';

export class KeuanganRepository {
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

  async checkWaliKelas(kelasId: string, guruId: string): Promise<boolean> {
    const res = await query(
      `SELECT 1 FROM kelas WHERE id = $1 AND wali_kelas_id = $2`,
      [kelasId, guruId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async checkKelasExists(kelasId: string): Promise<boolean> {
    const res = await query(`SELECT 1 FROM kelas WHERE id = $1`, [kelasId]);
    return (res.rowCount ?? 0) > 0;
  }

  async getTagihanSiswa(siswaId: string, statusFilter?: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    let filterClause = '';
    const params: any[] = [siswaId];

    if (statusFilter === 'Lunas') {
      filterClause = `AND lunas_pada IS NOT NULL`;
    } else if (statusFilter === 'Jatuh Tempo') {
      filterClause = `AND lunas_pada IS NULL AND jatuh_tempo < CURRENT_DATE`;
    } else if (statusFilter === 'Belum Lunas') {
      filterClause = `AND lunas_pada IS NULL AND jatuh_tempo >= CURRENT_DATE`;
    }

    const countRes = await query(
      `SELECT COUNT(*) AS total FROM tagihan WHERE siswa_id = $1 ${filterClause}`,
      params
    );
    const total = parseInt(countRes.rows[0].total, 10);

    const dataRes = await query(
      `SELECT 
        id,
        komponen,
        keterangan,
        nominal::float AS nominal,
        TO_CHAR(jatuh_tempo, 'YYYY-MM-DD') AS jatuh_tempo,
        CASE
          WHEN lunas_pada IS NOT NULL THEN 'Lunas'
          WHEN jatuh_tempo < CURRENT_DATE THEN 'Jatuh Tempo'
          ELSE 'Belum Lunas'
        END AS status
       FROM tagihan
       WHERE siswa_id = $1 ${filterClause}
       ORDER BY jatuh_tempo ASC, id ASC
       LIMIT $2 OFFSET $3`,
      [siswaId, limit, offset]
    );

    return { rows: dataRes.rows, total };
  }

  async getTotalTagihanBelumLunas(siswaId: string): Promise<number> {
    const res = await query(
      `SELECT COALESCE(SUM(nominal), 0)::float AS total
       FROM tagihan
       WHERE siswa_id = $1 AND lunas_pada IS NULL`,
      [siswaId]
    );
    return res.rows[0]?.total ?? 0;
  }

  async getInfoPembayaran() {
    const res = await query(
      `SELECT id, nama_bank, nomor_rekening, nama_penerima, jadwal_loket
       FROM info_pembayaran
       WHERE id = 1`
    );
    return res.rows[0] || null;
  }

  async getTagihanByIdAndSiswa(tagihanId: string, siswaId: string) {
    const res = await query(
      `SELECT id, siswa_id, nominal::float AS nominal, lunas_pada
       FROM tagihan
       WHERE id = $1 AND siswa_id = $2`,
      [tagihanId, siswaId]
    );
    return res.rows[0] || null;
  }

  async createPembayaran(
    tagihanId: string,
    nominal: number,
    tanggalTransfer: string,
    buktiPath: string
  ) {
    const res = await query(
      `INSERT INTO pembayaran (tagihan_id, nominal, tanggal_transfer, bukti_path, status, diupload_pada)
       VALUES ($1, $2, $3, $4, 'menunggu', CURRENT_TIMESTAMP)
       RETURNING id, tagihan_id, nominal::float AS nominal, 
                 TO_CHAR(tanggal_transfer, 'YYYY-MM-DD') AS tanggal_transfer, 
                 status, diupload_pada`,
      [tagihanId, nominal, tanggalTransfer, buktiPath]
    );
    return res.rows[0];
  }

  async getStatusPembayaranKelas(kelasId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;

    const countRes = await query(
      `SELECT COUNT(*) AS total FROM siswa WHERE kelas_id = $1`,
      [kelasId]
    );
    const total = parseInt(countRes.rows[0].total, 10);

    const rowsRes = await query(
      `SELECT 
        s.id AS siswa_id,
        s.nama,
        CASE
          WHEN COUNT(t.id) FILTER (WHERE t.lunas_pada IS NULL) = 0 THEN 'Lunas'
          ELSE 'Belum Lunas'
        END AS status
       FROM siswa s
       LEFT JOIN tagihan t ON t.siswa_id = s.id
       WHERE s.kelas_id = $1
       GROUP BY s.id, s.nama
       ORDER BY s.nama ASC
       LIMIT $2 OFFSET $3`,
      [kelasId, limit, offset]
    );

    return { rows: rowsRes.rows, total };
  }
}

export const keuanganRepository = new KeuanganRepository();
