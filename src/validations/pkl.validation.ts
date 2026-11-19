import { z } from 'zod';

export const reviewLaporanSchema = z
  .object({
    status: z.enum(['disetujui', 'revisi'], {
      required_error: 'Status wajib diisi (disetujui atau revisi)',
    }),
    catatan: z.string().max(1000, 'Catatan maksimal 1000 karakter').optional(),
  })
  .refine(
    (data) => {
      if (data.status === 'revisi' && (!data.catatan || data.catatan.trim() === '')) {
        return false;
      }
      return true;
    },
    {
      message: 'Catatan wajib diisi bila status adalah revisi',
      path: ['catatan'],
    }
  );

export const inputNilaiPklSchema = z.object({
  nilaiSekolah: z
    .number({ required_error: 'Nilai sekolah wajib diisi' })
    .min(0, 'Nilai sekolah minimal 0')
    .max(100, 'Nilai sekolah maksimal 100'),
  nilaiIndustri: z.object({
    sikap: z
      .number({ required_error: 'Nilai sikap wajib diisi' })
      .min(0, 'Nilai sikap minimal 0')
      .max(100, 'Nilai sikap maksimal 100'),
    keterampilan: z
      .number({ required_error: 'Nilai keterampilan wajib diisi' })
      .min(0, 'Nilai keterampilan minimal 0')
      .max(100, 'Nilai keterampilan maksimal 100'),
    kedisiplinan: z
      .number({ required_error: 'Nilai kedisiplinan wajib diisi' })
      .min(0, 'Nilai kedisiplinan minimal 0')
      .max(100, 'Nilai kedisiplinan maksimal 100'),
  }),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().min(1, 'Halaman minimal 1').default(1),
  limit: z.coerce.number().min(1, 'Limit minimal 1').max(100, 'Limit maksimal 100').default(20),
});
