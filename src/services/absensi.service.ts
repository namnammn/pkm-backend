import fs from 'fs';
import path from 'path';
import { absensiRepository } from '../repositories/absensi.repository.js';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  BusinessRuleError,
} from '../utils/errors.js';
import { config } from '../config/index.js';

function resolveUploadPath(storedPath: string): string {
  if (path.isAbsolute(storedPath)) {
    return storedPath;
  }
  return path.resolve(config.uploadDir, path.basename(storedPath));
}

export class AbsensiService {
  async getRekapSiswa(userId: string, bulan?: string, semester?: string) {
    if ((bulan && semester) || (!bulan && !semester)) {
      throw new ValidationError([
        {
          field: 'query',
          message: 'Wajib mengirim tepat satu parameter: bulan atau semester',
        },
      ]);
    }

    const siswa = await absensiRepository.getSiswaByUserId(userId);
    if (!siswa) {
      throw new ForbiddenError('Data siswa tidak ditemukan untuk akun ini');
    }

    let startDate: string;
    let endDate: string;

    if (bulan) {
      // Validasi format YYYY-MM
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(bulan)) {
        throw new ValidationError([
          {
            field: 'bulan',
            message: 'Format bulan harus YYYY-MM (contoh: 2026-10)',
          },
        ]);
      }
      const [year, month] = bulan.split('-').map(Number);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0); // hari terakhir bulan
      startDate = start.toISOString().split('T')[0];
      endDate = end.toISOString().split('T')[0];
    } else {
      // Semester format: {tahunMulai}-{tahunSelesai}-{ganjil|genap} contoh: 2026-2027-ganjil
      const parts = semester!.split('-');
      if (parts.length !== 3 || (parts[2] !== 'ganjil' && parts[2] !== 'genap')) {
        throw new ValidationError([
          {
            field: 'semester',
            message: 'Format semester harus {tahunMulai}-{tahunSelesai}-{ganjil|genap}',
          },
        ]);
      }
      const tahunAjaran = `${parts[0]}/${parts[1]}`;
      const semesterNama = parts[2];

      const semData = await absensiRepository.getSemesterBySpec(tahunAjaran, semesterNama);
      if (!semData) {
        throw new NotFoundError(`Semester ${tahunAjaran} ${semesterNama} tidak ditemukan`);
      }
      startDate = semData.tanggal_mulai;
      endDate = semData.tanggal_selesai;
    }

    const rekap = await absensiRepository.getRekapSiswa(siswa.id, startDate, endDate);
    return {
      hadir: rekap.hadir,
      izin: rekap.izin,
      sakit: rekap.sakit,
      alpa: rekap.alpa,
    };
  }

  async createIzin(
    userId: string,
    jenis: string,
    tanggalMulai: string,
    tanggalSelesai: string,
    file: Express.Multer.File,
    keterangan?: string
  ) {
    const siswa = await absensiRepository.getSiswaByUserId(userId);
    if (!siswa) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      throw new ForbiddenError('Data siswa tidak ditemukan untuk akun ini');
    }

    if (new Date(tanggalSelesai) < new Date(tanggalMulai)) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      throw new ValidationError([
        {
          field: 'tanggalSelesai',
          message: 'Tanggal selesai tidak boleh lebih awal dari tanggal mulai',
        },
      ]);
    }

    const relativePath = path.posix.join('uploads', file.filename || path.basename(file.path));

    const izin = await absensiRepository.createIzin(
      siswa.id,
      jenis,
      tanggalMulai,
      tanggalSelesai,
      relativePath,
      keterangan
    );

    return {
      id: izin.id,
      jenis: izin.jenis,
      tanggalMulai: izin.tanggal_mulai,
      tanggalSelesai: izin.tanggal_selesai,
      keterangan: izin.keterangan,
      status: izin.status,
      dibuatPada: izin.dibuat_pada,
    };
  }

  async getRekapKelas(userId: string, kelasId: string, bulan: string, page: number, limit: number) {
    const guru = await absensiRepository.getGuruByUserId(userId);
    if (!guru) {
      throw new ForbiddenError('Data guru tidak ditemukan untuk akun ini');
    }

    const kelasExists = await absensiRepository.checkKelasExists(kelasId);
    if (!kelasExists) {
      throw new NotFoundError('Kelas tidak ditemukan');
    }

    const hasAccess = await absensiRepository.checkAksesKelas(kelasId, guru.id);
    if (!hasAccess) {
      throw new ForbiddenError('Akses ditolak: Anda bukan wali kelas atau pengajar di kelas ini');
    }

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(bulan)) {
      throw new ValidationError([
        {
          field: 'bulan',
          message: 'Format bulan harus YYYY-MM (contoh: 2026-10)',
        },
      ]);
    }

    const [year, month] = bulan.split('-').map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    const startDate = start.toISOString().split('T')[0];
    const endDate = end.toISOString().split('T')[0];

    const { rows, total } = await absensiRepository.getRekapKelas(kelasId, startDate, endDate, page, limit);

    const data = rows.map((r) => ({
      siswaId: r.siswa_id,
      nis: r.nis,
      nama: r.nama,
      hadir: r.hadir,
      izin: r.izin,
      sakit: r.sakit,
      alpa: r.alpa,
    }));

    return {
      data,
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async inputAbsensiKelas(
    userId: string,
    kelasId: string,
    tanggal: string,
    data: Array<{ siswaId: string; status: string }>
  ) {
    const guru = await absensiRepository.getGuruByUserId(userId);
    if (!guru) {
      throw new ForbiddenError('Data guru tidak ditemukan untuk akun ini');
    }

    const kelasExists = await absensiRepository.checkKelasExists(kelasId);
    if (!kelasExists) {
      throw new NotFoundError('Kelas tidak ditemukan');
    }

    const hasAccess = await absensiRepository.checkAksesKelas(kelasId, guru.id);
    if (!hasAccess) {
      throw new ForbiddenError('Akses ditolak: Anda bukan wali kelas atau pengajar di kelas ini');
    }

    // Validasi tanggal tidak boleh di masa depan
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (new Date(tanggal) > today) {
      throw new ValidationError([
        {
          field: 'tanggal',
          message: 'Tanggal absensi tidak boleh di masa depan',
        },
      ]);
    }

    // Validasi siswa duplikat dalam request body
    const seenIds = new Set<string>();
    for (const item of data) {
      if (seenIds.has(item.siswaId)) {
        throw new BusinessRuleError('SISWA_DUPLIKAT', `Siswa dengan ID ${item.siswaId} ganda dalam satu request`);
      }
      seenIds.add(item.siswaId);
    }

    // Validasi semua siswaId merupakan anggota kelas
    const validSiswaIds = await absensiRepository.getSiswaIdsByKelas(kelasId);
    const validSet = new Set(validSiswaIds);

    for (const item of data) {
      if (!validSet.has(item.siswaId)) {
        throw new BusinessRuleError(
          'SISWA_BUKAN_ANGGOTA_KELAS',
          `Siswa dengan ID ${item.siswaId} bukan anggota dari kelas ini`
        );
      }
    }

    const tersimpan = await absensiRepository.upsertAbsensiKelas(tanggal, data, guru.id);

    return {
      tanggal,
      tersimpan,
    };
  }

  async getDaftarIzin(
    userId: string,
    status?: string,
    kelasId?: string,
    page = 1,
    limit = 20
  ) {
    const guru = await absensiRepository.getGuruByUserId(userId);
    if (!guru) {
      throw new ForbiddenError('Data guru tidak ditemukan untuk akun ini');
    }

    if (kelasId) {
      const kelasExists = await absensiRepository.checkKelasExists(kelasId);
      if (!kelasExists) {
        throw new NotFoundError('Kelas tidak ditemukan');
      }

      const hasAccess = await absensiRepository.checkAksesKelas(kelasId, guru.id);
      if (!hasAccess) {
        throw new ForbiddenError('Akses ditolak: Anda bukan wali kelas atau pengajar di kelas ini');
      }
    }

    const { rows, total } = await absensiRepository.getDaftarIzin(
      guru.id,
      status,
      kelasId,
      page,
      limit
    );

    const data = rows.map((r) => ({
      id: r.id,
      siswa: {
        id: r.siswa_id,
        nis: r.nis,
        nama: r.nama,
        kelas: r.kelas_nama,
      },
      jenis: r.jenis,
      tanggalMulai: r.tanggal_mulai,
      tanggalSelesai: r.tanggal_selesai,
      status: r.status,
      dibuatPada: r.dibuat_pada,
    }));

    return {
      data,
      meta: {
        page,
        limit,
        total,
      },
    };
  }

  async getIzinDetail(userId: string, izinId: string, acceptHeader?: string) {
    const guru = await absensiRepository.getGuruByUserId(userId);
    if (!guru) {
      throw new ForbiddenError('Data guru tidak ditemukan untuk akun ini');
    }

    const izin = await absensiRepository.getIzinById(izinId);
    if (!izin) {
      throw new NotFoundError('Pengajuan izin tidak ditemukan');
    }

    const hasAccess = await absensiRepository.checkAksesKelas(izin.kelas_id, guru.id);
    if (!hasAccess) {
      throw new ForbiddenError('Akses ditolak: Anda bukan wali kelas atau pengajar dari kelas siswa ini');
    }

    const isMediaRequest =
      acceptHeader &&
      (acceptHeader.includes('image/') || acceptHeader.includes('application/pdf'));

    const resolvedPath = izin.lampiran_path ? resolveUploadPath(izin.lampiran_path) : null;

    if (isMediaRequest && resolvedPath && fs.existsSync(resolvedPath)) {
      const ext = path.extname(resolvedPath).toLowerCase();
      let contentType = 'application/octet-stream';
      if (ext === '.pdf') contentType = 'application/pdf';
      else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
      else if (ext === '.png') contentType = 'image/png';

      return {
        isStream: true,
        filePath: resolvedPath,
        fileName: path.basename(resolvedPath),
        contentType,
      };
    }

    return {
      isStream: false,
      data: {
        id: izin.id,
        siswa: {
          id: izin.siswa_id,
          nis: izin.siswa_nis,
          nama: izin.siswa_nama,
          kelas: izin.kelas_nama,
        },
        jenis: izin.jenis,
        tanggalMulai: izin.tanggal_mulai,
        tanggalSelesai: izin.tanggal_selesai,
        keterangan: izin.keterangan,
        status: izin.status,
        catatan: izin.catatan,
        dibuatPada: izin.dibuat_pada,
        diputuskanPada: izin.diputuskan_pada,
      },
    };
  }

  async putuskanIzin(userId: string, izinId: string, status: 'disetujui' | 'ditolak', catatan?: string) {
    const guru = await absensiRepository.getGuruByUserId(userId);
    if (!guru) {
      throw new ForbiddenError('Data guru tidak ditemukan untuk akun ini');
    }

    const izin = await absensiRepository.getIzinById(izinId);
    if (!izin) {
      throw new NotFoundError('Pengajuan izin tidak ditemukan');
    }

    const hasAccess = await absensiRepository.checkAksesKelas(izin.kelas_id, guru.id);
    if (!hasAccess) {
      throw new ForbiddenError('Akses ditolak: Anda bukan wali kelas atau pengajar dari kelas siswa ini');
    }

    if (izin.status !== 'menunggu') {
      throw new BusinessRuleError('IZIN_SUDAH_DIPUTUSKAN', 'Pengajuan izin ini sudah diputuskan sebelumnya');
    }

    const updated = await absensiRepository.putuskanIzin(
      izinId,
      status,
      catatan || null,
      guru.id,
      {
        siswaId: izin.siswa_id,
        jenis: izin.jenis,
        tanggalMulai: izin.tanggal_mulai,
        tanggalSelesai: izin.tanggal_selesai,
      }
    );

    return {
      id: updated.id,
      siswa: {
        id: izin.siswa_id,
        nis: izin.siswa_nis,
        nama: izin.siswa_nama,
        kelas: izin.kelas_nama,
      },
      jenis: updated.jenis,
      tanggalMulai: updated.tanggal_mulai,
      tanggalSelesai: updated.tanggal_selesai,
      keterangan: updated.keterangan,
      status: updated.status,
      catatan: updated.catatan,
      dibuatPada: updated.dibuat_pada,
      diputuskanPada: updated.diputuskan_pada,
    };
  }
}

export const absensiService = new AbsensiService();
