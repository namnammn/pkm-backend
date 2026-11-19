export type UserRole = 'siswa' | 'guru';

export interface JwtPayload {
  userId: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export type StatusPkl = 'Belum Dimulai' | 'Aktif' | 'Selesai';
export type StatusLaporan = 'menunggu' | 'disetujui' | 'revisi';
export type StatusAbsensi = 'hadir' | 'izin' | 'sakit' | 'alpa';
export type JenisIzin = 'izin' | 'sakit';
export type StatusIzin = 'menunggu' | 'disetujui' | 'ditolak';
export type KomponenTagihan = 'SPP' | 'BAHAN_PRAKTIKUM' | 'UKK';
export type StatusTagihan = 'Lunas' | 'Belum Lunas' | 'Jatuh Tempo';
export type StatusPembayaran = 'menunggu' | 'diverifikasi' | 'ditolak';

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
}

export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
}
