import fs from 'fs';
import path from 'path';
import { keuanganRepository } from '../repositories/keuangan.repository.js';
import {
  ForbiddenError,
  NotFoundError,
  TagihanNotFoundError,
  BusinessRuleError,
} from '../utils/errors.js';

export class KeuanganService {
  async getTagihanSiswa(userId: string, status?: string, page = 1, limit = 20) {
    const siswa = await keuanganRepository.getSiswaByUserId(userId);
    if (!siswa) {
      throw new ForbiddenError('Data siswa tidak ditemukan untuk akun ini');
    }

    const { rows, total } = await keuanganRepository.getTagihanSiswa(siswa.id, status, page, limit);

    const data = rows.map((r) => ({
      id: r.id,
      komponen: r.komponen,
      keterangan: r.keterangan,
      nominal: r.nominal,
      jatuhTempo: r.jatuh_tempo,
      status: r.status,
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

  async getRingkasanTagihan(userId: string) {
    const siswa = await keuanganRepository.getSiswaByUserId(userId);
    if (!siswa) {
      throw new ForbiddenError('Data siswa tidak ditemukan untuk akun ini');
    }

    const total = await keuanganRepository.getTotalTagihanBelumLunas(siswa.id);
    return { total };
  }

  async getInfoPembayaran(userId: string) {
    const siswa = await keuanganRepository.getSiswaByUserId(userId);
    if (!siswa) {
      throw new ForbiddenError('Data siswa tidak ditemukan untuk akun ini');
    }

    const info = await keuanganRepository.getInfoPembayaran();
    if (!info) {
      throw new NotFoundError('Informasi rekening pembayaran belum dikonfigurasi');
    }

    return {
      namaBank: info.nama_bank,
      nomorRekening: info.nomor_rekening,
      namaPenerima: info.nama_penerima,
      jadwalLoket: info.jadwal_loket,
    };
  }

  async createPembayaran(
    userId: string,
    tagihanId: string,
    nominal: number,
    tanggalTransfer: string,
    file: Express.Multer.File
  ) {
    const siswa = await keuanganRepository.getSiswaByUserId(userId);
    if (!siswa) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      throw new ForbiddenError('Data siswa tidak ditemukan untuk akun ini');
    }

    const tagihan = await keuanganRepository.getTagihanByIdAndSiswa(tagihanId, siswa.id);
    if (!tagihan) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      throw new TagihanNotFoundError();
    }

    if (tagihan.lunas_pada !== null) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      throw new BusinessRuleError('TAGIHAN_SUDAH_LUNAS', 'Tagihan ini sudah berstatus lunas');
    }

    const relativePath = path.posix.join('uploads', file.filename || path.basename(file.path));

    const result = await keuanganRepository.createPembayaran(
      tagihanId,
      nominal,
      tanggalTransfer,
      relativePath
    );

    return {
      id: result.id,
      tagihanId: result.tagihan_id,
      nominal: result.nominal,
      tanggalTransfer: result.tanggal_transfer,
      status: result.status,
      diuploadPada: result.diupload_pada,
    };
  }

  async getStatusPembayaranKelas(userId: string, kelasId: string, page = 1, limit = 20) {
    const guru = await keuanganRepository.getGuruByUserId(userId);
    if (!guru) {
      throw new ForbiddenError('Data guru tidak ditemukan untuk akun ini');
    }

    const kelasExists = await keuanganRepository.checkKelasExists(kelasId);
    if (!kelasExists) {
      throw new NotFoundError('Kelas tidak ditemukan');
    }

    const isWaliKelas = await keuanganRepository.checkWaliKelas(kelasId, guru.id);
    if (!isWaliKelas) {
      throw new ForbiddenError('Akses ditolak: Hanya wali kelas yang berhak melihat status keuangan kelas');
    }

    const { rows, total } = await keuanganRepository.getStatusPembayaranKelas(kelasId, page, limit);

    const data = rows.map((r) => ({
      siswaId: r.siswa_id,
      nama: r.nama,
      status: r.status,
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
}

export const keuanganService = new KeuanganService();
