import { StatusPkl } from '../types/index.js';

export function calculateStatusPkl(mulai: string | Date, selesai: string | Date): StatusPkl {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = new Date(mulai);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(selesai);
  endDate.setHours(23, 59, 59, 999);

  if (today < startDate) {
    return 'Belum Dimulai';
  } else if (today > endDate) {
    return 'Selesai';
  } else {
    return 'Aktif';
  }
}

export function calculatePklProgress(
  mulai: string | Date,
  selesai: string | Date,
  status: StatusPkl
): { bulanKe: number; totalBulan: number } {
  const startDate = new Date(mulai);
  const endDate = new Date(selesai);

  // Total bulan dihitung dari rentang hari / 30 atau selisih bulan, dibulatkan ke atas
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const totalBulan = Math.max(1, Math.ceil(diffDays / 30));

  if (status === 'Belum Dimulai') {
    return { bulanKe: 0, totalBulan };
  }
  if (status === 'Selesai') {
    return { bulanKe: totalBulan, totalBulan };
  }

  // Jika Aktif: hitung bulan berjalan mulai dari 1
  const today = new Date();
  const elapsedDays = Math.max(0, Math.ceil((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const bulanKe = Math.min(totalBulan, Math.max(1, Math.ceil(elapsedDays / 30)));

  return { bulanKe, totalBulan };
}
