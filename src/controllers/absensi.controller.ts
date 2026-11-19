import { Request, Response, NextFunction } from 'express';
import { absensiService } from '../services/absensi.service.js';
import { BadRequestError } from '../utils/errors.js';
import path from 'path';

export class AbsensiController {
  // S-ABS-1: GET /siswa/absensi/rekap?bulan=&semester=
  async getRekapSiswa(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { bulan, semester } = req.query as { bulan?: string; semester?: string };
      const data = await absensiService.getRekapSiswa(userId, bulan, semester);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  // S-ABS-2: POST /siswa/izin
  async createIzin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new BadRequestError('Lampiran surat izin (JPG/PNG/PDF) wajib diupload');
      }
      const userId = req.user!.userId;
      const { jenis, tanggalMulai, tanggalSelesai, keterangan } = req.body;

      const data = await absensiService.createIzin(
        userId,
        jenis,
        tanggalMulai,
        tanggalSelesai,
        req.file,
        keterangan
      );
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  }

  // G-ABS-1: GET /guru/kelas/:kelasId/absensi/rekap?bulan=
  async getRekapKelas(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { kelasId } = req.params;
      const bulan = req.query.bulan as string;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;

      const result = await absensiService.getRekapKelas(userId, kelasId, bulan, page, limit);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  // G-ABS-2: POST /guru/kelas/:kelasId/absensi
  async inputAbsensiKelas(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { kelasId } = req.params;
      const { tanggal, data } = req.body;

      const result = await absensiService.inputAbsensiKelas(userId, kelasId, tanggal, data);
      res.status(201).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  // G-ABS-3: GET /guru/izin?status=&kelasId=&page=&limit=
  async getDaftarIzin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const status = req.query.status as string | undefined;
      const kelasId = req.query.kelasId as string | undefined;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;

      const result = await absensiService.getDaftarIzin(userId, status, kelasId, page, limit);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  // G-ABS-4: GET /guru/izin/:id
  async getIzinDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const acceptHeader = req.headers.accept;

      const result = await absensiService.getIzinDetail(userId, id, acceptHeader);
      if (result.isStream && result.filePath) {
        res.setHeader('Content-Type', result.contentType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${result.fileName}"`);
        res.sendFile(path.resolve(result.filePath));
        return;
      }

      res.status(200).json({ data: result.data });
    } catch (err) {
      next(err);
    }
  }

  // G-ABS-5: PATCH /guru/izin/:id/keputusan
  async putuskanIzin(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const { status, catatan } = req.body;

      const data = await absensiService.putuskanIzin(userId, id, status, catatan);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }
}

export const absensiController = new AbsensiController();
