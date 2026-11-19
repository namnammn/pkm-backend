import fs from 'fs';
import path from 'path';
import { pklRepository } from '../repositories/pkl.repository.js';
import { calculateStatusPkl, calculatePklProgress } from '../utils/date.js';
import {
  PklNotFoundError,
  ForbiddenError,
  NotFoundError,
  BusinessRuleError,
} from '../utils/errors.js';
import { config } from '../config/index.js';

function resolveUploadPath(storedPath: string): string {
  if (path.isAbsolute(storedPath)) {
    return storedPath;
  }
  return path.resolve(config.uploadDir, path.basename(storedPath));
}

export class PklService {
  async getStatusPkl(userId: string) {
    const siswa = await pklRepository.getSiswaByUserId(userId);
    if (!siswa) {
      throw new ForbiddenError('Data siswa tidak ditemukan untuk akun ini');
    }

    const penempatan = await pklRepository.getPenempatanBySiswaId(siswa.id);
    if (!penempatan) {
      throw new PklNotFoundError();
    }

    const status = calculateStatusPkl(penempatan.tanggal_mulai, penempatan.tanggal_selesai);
    const progres = calculatePklProgress(penempatan.tanggal_mulai, penempatan.tanggal_selesai, status);

    return {
      status,
      industri: {
        nama: penempatan.dudi_nama,
        alamat: penempatan.dudi_alamat,
      },
      pembimbingIndustri: {
        nama: penempatan.dudi_pembimbing_nama,
        kontak: penempatan.dudi_pembimbing_kontak,
      },
      guruPembimbing: {
        nama: penempatan.guru_nama,
        kontak: penempatan.guru_kontak,
      },
      periode: {
        mulai: penempatan.tanggal_mulai,
        selesai: penempatan.tanggal_selesai,
      },
      progres,
      laporan: penempatan.laporan_status
        ? {
            status: penempatan.laporan_status,
            catatan: penempatan.laporan_catatan || null,
          }
        : null,
    };
  }

  async getNilaiPkl(userId: string) {
    const siswa = await pklRepository.getSiswaByUserId(userId);
    if (!siswa) {
      throw new ForbiddenError('Data siswa tidak ditemukan untuk akun ini');
    }

    const penempatan = await pklRepository.getPenempatanBySiswaId(siswa.id);
    if (!penempatan) {
      throw new PklNotFoundError();
    }

    const nilai = await pklRepository.getNilaiByPenempatanId(penempatan.id);
    if (!nilai) {
      return {
        sikap: null,
        keterampilan: null,
        kedisiplinan: null,
        nilaiAkhir: null,
      };
    }

    return {
      sikap: nilai.nilai_sikap,
      keterampilan: nilai.nilai_keterampilan,
      kedisiplinan: nilai.nilai_kedisiplinan,
      nilaiAkhir: nilai.nilai_akhir,
    };
  }

  async uploadLaporan(userId: string, file: Express.Multer.File) {
    const siswa = await pklRepository.getSiswaByUserId(userId);
    if (!siswa) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      throw new ForbiddenError('Data siswa tidak ditemukan untuk akun ini');
    }

    const penempatan = await pklRepository.getPenempatanBySiswaId(siswa.id);
    if (!penempatan) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      throw new PklNotFoundError();
    }

    const existingLaporan = await pklRepository.getLaporanByPenempatanId(penempatan.id);

    const relativePath = path.posix.join('uploads', file.filename || path.basename(file.path));

    if (!existingLaporan) {
      const created = await pklRepository.createLaporan(penempatan.id, relativePath);
      return {
        isNew: true,
        data: {
          id: created.id,
          status: created.status,
          diuploadPada: created.diupload_pada,
        },
      };
    }

    if (existingLaporan.status === 'revisi') {
      // Hapus file laporan lama jika ada
      if (existingLaporan.file_path) {
        const oldFile = resolveUploadPath(existingLaporan.file_path);
        if (fs.existsSync(oldFile)) {
          try {
            fs.unlinkSync(oldFile);
          } catch (e) {
            console.error('Gagal menghapus file lama:', e);
          }
        }
      }

      const updated = await pklRepository.updateLaporanFile(existingLaporan.id, relativePath);
      return {
        isNew: false,
        data: {
          id: updated.id,
          status: updated.status,
          diuploadPada: updated.diupload_pada,
        },
      };
    }

    // Status menunggu atau disetujui tidak boleh diubah
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    throw new BusinessRuleError(
      'LAPORAN_TIDAK_DAPAT_DIUBAH',
      'Laporan tidak dapat diubah karena sedang menunggu review atau sudah disetujui'
    );
  }

  async getSiswaBimbingan(userId: string, page: number, limit: number) {
    const guru = await pklRepository.getGuruByUserId(userId);
    if (!guru) {
      throw new ForbiddenError('Data guru tidak ditemukan untuk akun ini');
    }

    const { rows, total } = await pklRepository.getSiswaBimbingan(guru.id, page, limit);

    const data = rows.map((row) => {
      const statusPkl = calculateStatusPkl(row.tanggal_mulai, row.tanggal_selesai);
      return {
        siswaId: row.siswa_id,
        nis: row.nis,
        nama: row.siswa_nama,
        statusPkl,
        industri: {
          nama: row.dudi_nama,
          alamat: row.dudi_alamat,
        },
        pembimbingIndustri: {
          nama: row.dudi_pembimbing_nama,
          kontak: row.dudi_pembimbing_kontak,
        },
        laporan: row.laporan_id
          ? {
              id: row.laporan_id,
              status: row.laporan_status,
            }
          : null,
      };
    });

    return {
      data,
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async getLaporanDetail(userId: string, laporanId: string, acceptHeader?: string) {
    const guru = await pklRepository.getGuruByUserId(userId);
    if (!guru) {
      throw new ForbiddenError('Data guru tidak ditemukan untuk akun ini');
    }

    const laporan = await pklRepository.getLaporanById(laporanId);
    if (!laporan) {
      throw new NotFoundError('Laporan PKL tidak ditemukan');
    }

    if (laporan.guru_pembimbing_id !== guru.id) {
      throw new ForbiddenError('Akses ditolak: Laporan ini bukan milik siswa bimbingan Anda');
    }

    if (acceptHeader && acceptHeader.includes('application/pdf')) {
      const fullPath = resolveUploadPath(laporan.file_path);
      return {
        isStream: true,
        filePath: fullPath,
        fileName: path.basename(laporan.file_path),
      };
    }

    return {
      isStream: false,
      data: {
        id: laporan.id,
        siswa: {
          id: laporan.siswa_id,
          nis: laporan.siswa_nis,
          nama: laporan.siswa_nama,
        },
        namaFile: path.basename(laporan.file_path),
        status: laporan.status,
        catatan: laporan.catatan,
        diuploadPada: laporan.diupload_pada,
        diperiksaPada: laporan.diperiksa_pada,
      },
    };
  }

  async reviewLaporan(userId: string, laporanId: string, status: 'disetujui' | 'revisi', catatan?: string) {
    const guru = await pklRepository.getGuruByUserId(userId);
    if (!guru) {
      throw new ForbiddenError('Data guru tidak ditemukan untuk akun ini');
    }

    const laporan = await pklRepository.getLaporanById(laporanId);
    if (!laporan) {
      throw new NotFoundError('Laporan PKL tidak ditemukan');
    }

    if (laporan.guru_pembimbing_id !== guru.id) {
      throw new ForbiddenError('Akses ditolak: Laporan ini bukan milik siswa bimbingan Anda');
    }

    if (laporan.status !== 'menunggu') {
      throw new BusinessRuleError(
        'LAPORAN_TIDAK_DAPAT_DIREVIEW',
        'Hanya laporan dengan status menunggu yang dapat direview'
      );
    }

    const updated = await pklRepository.updateLaporanReview(
      laporanId,
      status,
      status === 'revisi' ? catatan || null : catatan || null,
      guru.id
    );

    return {
      id: updated.id,
      siswa: {
        id: laporan.siswa_id,
        nis: laporan.siswa_nis,
        nama: laporan.siswa_nama,
      },
      namaFile: path.basename(laporan.file_path),
      status: updated.status,
      catatan: updated.catatan,
      diuploadPada: updated.diupload_pada,
      diperiksaPada: updated.diperiksa_pada,
    };
  }

  async inputNilaiPkl(
    userId: string,
    siswaId: string,
    nilaiSekolah: number,
    nilaiIndustri: { sikap: number; keterampilan: number; kedisiplinan: number }
  ) {
    const guru = await pklRepository.getGuruByUserId(userId);
    if (!guru) {
      throw new ForbiddenError('Data guru tidak ditemukan untuk akun ini');
    }

    const penempatan = await pklRepository.checkPenempatanGuru(siswaId, guru.id);
    if (!penempatan) {
      throw new ForbiddenError('Akses ditolak: Siswa ini bukan bimbingan Anda');
    }

    // Hitung rata-rata industri
    const rataRataIndustri =
      (nilaiIndustri.sikap + nilaiIndustri.keterampilan + nilaiIndustri.kedisiplinan) / 3;

    // Bobot dihitung dari config aplikasi
    const bobotSekolah = config.bobotNilai.sekolah / 100;
    const bobotIndustri = config.bobotNilai.industri / 100;

    const nilaiAkhirRaw = nilaiSekolah * bobotSekolah + rataRataIndustri * bobotIndustri;
    const nilaiAkhir = Math.round(nilaiAkhirRaw * 10) / 10;

    const savedNilai = await pklRepository.upsertNilaiPkl(
      penempatan.id,
      nilaiSekolah,
      nilaiIndustri.sikap,
      nilaiIndustri.keterampilan,
      nilaiIndustri.kedisiplinan,
      nilaiAkhir,
      guru.id
    );

    return {
      siswaId,
      nilaiSekolah: savedNilai.nilai_sekolah,
      nilaiIndustri: {
        sikap: savedNilai.nilai_sikap,
        keterampilan: savedNilai.nilai_keterampilan,
        kedisiplinan: savedNilai.nilai_kedisiplinan,
      },
      nilaiAkhir: savedNilai.nilai_akhir,
    };
  }
}

export const pklService = new PklService();
