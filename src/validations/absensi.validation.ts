import { z } from 'zod';

export const createIzinSchema = z.object({
  jenis: z.enum(['izin', 'sakit'], {
    required_error: 'Jenis izin wajib diisi (izin atau sakit)',
  }),
  tanggalMulai: z.string({ required_error: 'Tanggal mulai wajib diisi' }).regex(
    /^\d{4}-\d{2}-\d{2}$/,
    'Format tanggal mulai harus YYYY-MM-DD'
  ),
  tanggalSelesai: z.string({ required_error: 'Tanggal selesai wajib diisi' }).regex(
    /^\d{4}-\d{2}-\d{2}$/,
    'Format tanggal selesai harus YYYY-MM-DD'
  ),
  keterangan: z.string().max(500, 'Keterangan maksimal 500 karakter').optional(),
});

export const inputAbsensiKelasSchema = z.object({
  tanggal: z.string({ required_error: 'Tanggal absensi wajib diisi' }).regex(
    /^\d{4}-\d{2}-\d{2}$/,
    'Format tanggal harus YYYY-MM-DD'
  ),
  data: z
    .array(
      z.object({
        siswaId: z.string({ required_error: 'siswaId wajib diisi' }).uuid('Format siswaId harus UUID'),
        status: z.enum(['hadir', 'izin', 'sakit', 'alpa'], {
          required_error: 'Status harus salah satu dari: hadir, izin, sakit, alpa',
        }),
      })
    )
    .min(1, 'Data absensi minimal 1 item'),
});

export const putuskanIzinSchema = z
  .object({
    status: z.enum(['disetujui', 'ditolak'], {
      required_error: 'Status wajib diisi (disetujui atau ditolak)',
    }),
    catatan: z.string().max(1000, 'Catatan maksimal 1000 karakter').optional(),
  })
  .refine(
    (data) => {
      if (data.status === 'ditolak' && (!data.catatan || data.catatan.trim() === '')) {
        return false;
      }
      return true;
    },
    {
      message: 'Catatan wajib diisi bila status adalah ditolak',
      path: ['catatan'],
    }
  );

export const daftarIzinQuerySchema = z.object({
  status: z.enum(['menunggu', 'disetujui', 'ditolak']).optional(),
  kelasId: z.string().uuid('Format kelasId harus UUID').optional(),
  page: z.coerce.number().min(1, 'Halaman minimal 1').default(1),
  limit: z.coerce.number().min(1, 'Limit minimal 1').max(100, 'Limit maksimal 100').default(20),
});

