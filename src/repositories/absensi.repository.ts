import { query, getClient } from '../config/db.js';

export class AbsensiRepository {
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

  async checkAksesKelas(kelasId: string, guruId: string): Promise<boolean> {
    const res = await query(
      `SELECT 1 FROM kelas k
       LEFT JOIN kelas_guru kg ON kg.kelas_id = k.id AND kg.guru_id = $2
       WHERE k.id = $1 AND (k.wali_kelas_id = $2 OR kg.guru_id IS NOT NULL)`,
      [kelasId, guruId]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async checkKelasExists(kelasId: string): Promise<boolean> {
    const res = await query(`SELECT 1 FROM kelas WHERE id = $1`, [kelasId]);
    return (res.rowCount ?? 0) > 0;
  }

  async getSemesterBySpec(tahunAjaran: string, nama: string) {
    const res = await query(
      `SELECT id, tahun_ajaran, nama, 
              TO_CHAR(tanggal_mulai, 'YYYY-MM-DD') AS tanggal_mulai, 
              TO_CHAR(tanggal_selesai, 'YYYY-MM-DD') AS tanggal_selesai
       FROM semester 
       WHERE tahun_ajaran = $1 AND nama = $2`,
      [tahunAjaran, nama]
    );
    return res.rows[0] || null;
  }

  async getRekapSiswa(siswaId: string, startDate: string, endDate: string) {
    const res = await query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'hadir')::int AS hadir,
        COUNT(*) FILTER (WHERE status = 'izin')::int  AS izin,
        COUNT(*) FILTER (WHERE status = 'sakit')::int AS sakit,
        COUNT(*) FILTER (WHERE status = 'alpa')::int  AS alpa
       FROM absensi
       WHERE siswa_id = $1
         AND tanggal >= $2 AND tanggal <= $3`,
      [siswaId, startDate, endDate]
    );
    return res.rows[0];
  }

  async createIzin(
    siswaId: string,
    jenis: string,
    tanggalMulai: string,
    tanggalSelesai: string,
    lampiranPath: string,
    keterangan?: string
  ) {
    const res = await query(
      `INSERT INTO izin (siswa_id, jenis, tanggal_mulai, tanggal_selesai, lampiran_path, keterangan, status, dibuat_pada)
       VALUES ($1, $2, $3, $4, $5, $6, 'menunggu', CURRENT_TIMESTAMP)
       RETURNING id, jenis, TO_CHAR(tanggal_mulai, 'YYYY-MM-DD') AS tanggal_mulai, 
                 TO_CHAR(tanggal_selesai, 'YYYY-MM-DD') AS tanggal_selesai, 
                 keterangan, status, dibuat_pada`,
      [siswaId, jenis, tanggalMulai, tanggalSelesai, lampiranPath, keterangan || null]
    );
    return res.rows[0];
  }

  async getRekapKelas(kelasId: string, startDate: string, endDate: string, page: number, limit: number) {
    const offset = (page - 1) * limit;

    const countRes = await query(
      `SELECT COUNT(*) AS total FROM siswa WHERE kelas_id = $1`,
      [kelasId]
    );
    const total = parseInt(countRes.rows[0].total, 10);

    const rowsRes = await query(
      `SELECT 
        s.id AS siswa_id,
        s.nis,
        s.nama,
        COALESCE(COUNT(*) FILTER (WHERE a.status = 'hadir'), 0)::int AS hadir,
        COALESCE(COUNT(*) FILTER (WHERE a.status = 'izin'), 0)::int  AS izin,
        COALESCE(COUNT(*) FILTER (WHERE a.status = 'sakit'), 0)::int AS sakit,
        COALESCE(COUNT(*) FILTER (WHERE a.status = 'alpa'), 0)::int  AS alpa
       FROM siswa s
       LEFT JOIN absensi a ON a.siswa_id = s.id AND a.tanggal >= $2 AND a.tanggal <= $3
       WHERE s.kelas_id = $1
       GROUP BY s.id, s.nis, s.nama
       ORDER BY s.nama ASC
       LIMIT $4 OFFSET $5`,
      [kelasId, startDate, endDate, limit, offset]
    );

    return { rows: rowsRes.rows, total };
  }

  async getSiswaIdsByKelas(kelasId: string): Promise<string[]> {
    const res = await query(`SELECT id FROM siswa WHERE kelas_id = $1`, [kelasId]);
    return res.rows.map((r) => r.id);
  }

  async upsertAbsensiKelas(
    tanggal: string,
    items: Array<{ siswaId: string; status: string }>,
    guruId: string
  ): Promise<number> {
    const client = await getClient();
    try {
      await client.query('BEGIN');
      for (const item of items) {
        await client.query(
          `INSERT INTO absensi (siswa_id, tanggal, status, dicatat_oleh)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (siswa_id, tanggal) 
           DO UPDATE SET status = EXCLUDED.status, dicatat_oleh = EXCLUDED.dicatat_oleh`,
          [item.siswaId, tanggal, item.status, guruId]
        );
      }
      await client.query('COMMIT');
      return items.length;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getDaftarIzin(
    guruId: string,
    status?: string,
    kelasId?: string,
    page = 1,
    limit = 20
  ) {
    const offset = (page - 1) * limit;

    const countRes = await query(
      `SELECT COUNT(i.id) AS total
       FROM izin i
       JOIN siswa s ON s.id = i.siswa_id
       JOIN kelas k ON k.id = s.kelas_id
       LEFT JOIN kelas_guru kg ON kg.kelas_id = k.id AND kg.guru_id = $1
       WHERE (k.wali_kelas_id = $1 OR kg.guru_id IS NOT NULL)
         AND ($2::status_izin IS NULL OR i.status = $2)
         AND ($3::uuid IS NULL OR k.id = $3)`,
      [guruId, status || null, kelasId || null]
    );
    const total = parseInt(countRes.rows[0]?.total ?? '0', 10);

    const rowsRes = await query(
      `SELECT i.id, i.jenis, 
              TO_CHAR(i.tanggal_mulai, 'YYYY-MM-DD') AS tanggal_mulai, 
              TO_CHAR(i.tanggal_selesai, 'YYYY-MM-DD') AS tanggal_selesai, 
              i.status, i.dibuat_pada,
              s.id AS siswa_id, s.nis, s.nama, k.nama AS kelas_nama
       FROM izin i
       JOIN siswa s ON s.id = i.siswa_id
       JOIN kelas k ON k.id = s.kelas_id
       LEFT JOIN kelas_guru kg ON kg.kelas_id = k.id AND kg.guru_id = $1
       WHERE (k.wali_kelas_id = $1 OR kg.guru_id IS NOT NULL)
         AND ($2::status_izin IS NULL OR i.status = $2)
         AND ($3::uuid IS NULL OR k.id = $3)
       ORDER BY i.dibuat_pada DESC
       LIMIT $4 OFFSET $5`,
      [guruId, status || null, kelasId || null, limit, offset]
    );

    return { rows: rowsRes.rows, total };
  }

  async getIzinById(id: string) {
    const res = await query(
      `SELECT 
        i.id,
        i.siswa_id,
        i.jenis,
        TO_CHAR(i.tanggal_mulai, 'YYYY-MM-DD') AS tanggal_mulai,
        TO_CHAR(i.tanggal_selesai, 'YYYY-MM-DD') AS tanggal_selesai,
        i.lampiran_path,
        i.keterangan,
        i.status,
        i.catatan,
        i.dibuat_pada,
        i.diputuskan_pada,
        s.nis AS siswa_nis,
        s.nama AS siswa_nama,
        s.kelas_id,
        k.nama AS kelas_nama
       FROM izin i
       JOIN siswa s ON s.id = i.siswa_id
       JOIN kelas k ON k.id = s.kelas_id
       WHERE i.id = $1`,
      [id]
    );
    return res.rows[0] || null;
  }

  async putuskanIzin(
    izinId: string,
    status: 'disetujui' | 'ditolak',
    catatan: string | null,
    guruId: string,
    izinData?: { siswaId: string; jenis: string; tanggalMulai: string; tanggalSelesai: string }
  ) {
    const client = await getClient();
    try {
      await client.query('BEGIN');

      const updateRes = await client.query(
        `UPDATE izin
         SET status = $1, catatan = $2, diputuskan_oleh = $3, diputuskan_pada = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING id, jenis, TO_CHAR(tanggal_mulai, 'YYYY-MM-DD') AS tanggal_mulai, 
                   TO_CHAR(tanggal_selesai, 'YYYY-MM-DD') AS tanggal_selesai, 
                   keterangan, status, catatan, dibuat_pada, diputuskan_pada`,
        [status, catatan, guruId, izinId]
      );

      // Efek samping jika disetujui: upsert absensi untuk tiap tanggal dalam rentang izin
      if (status === 'disetujui' && izinData) {
        const cur = new Date(izinData.tanggalMulai);
        const end = new Date(izinData.tanggalSelesai);
        const absensiStatus = izinData.jenis === 'sakit' ? 'sakit' : 'izin';

        while (cur <= end) {
          const tglStr = cur.toISOString().split('T')[0];
          await client.query(
            `INSERT INTO absensi (siswa_id, tanggal, status, izin_id, dicatat_oleh)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (siswa_id, tanggal) 
             DO UPDATE SET status = EXCLUDED.status, izin_id = EXCLUDED.izin_id, dicatat_oleh = EXCLUDED.dicatat_oleh`,
            [izinData.siswaId, tglStr, absensiStatus, izinId, guruId]
          );
          cur.setDate(cur.getDate() + 1);
        }
      }

      await client.query('COMMIT');
      return updateRes.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

export const absensiRepository = new AbsensiRepository();
