import { z } from 'zod';

export const createPembayaranSchema = z.object({
  tagihanId: z.string({ required_error: 'tagihanId wajib diisi' }).uuid('Format tagihanId harus UUID'),
  nominal: z.coerce
    .number({ required_error: 'Nominal wajib diisi' })
    .positive('Nominal pembayaran harus lebih dari 0'),
  tanggalTransfer: z.string({ required_error: 'Tanggal transfer wajib diisi' }).regex(
    /^\d{4}-\d{2}-\d{2}$/,
    'Format tanggal transfer harus YYYY-MM-DD'
  ),
});

export const tagihanQuerySchema = z.object({
  status: z.enum(['Lunas', 'Belum Lunas', 'Jatuh Tempo']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});
