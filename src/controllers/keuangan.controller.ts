import { Request, Response, NextFunction } from 'express';
import { keuanganService } from '../services/keuangan.service.js';
import { BadRequestError } from '../utils/errors.js';

export class KeuanganController {
  // S-KEU-1: GET /siswa/tagihan?status=&page=&limit=
  async getTagihanSiswa(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const status = req.query.status as string | undefined;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;

      const result = await keuanganService.getTagihanSiswa(userId, status, page, limit);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  // S-KEU-2: GET /siswa/tagihan/ringkasan
  async getRingkasanTagihan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const data = await keuanganService.getRingkasanTagihan(userId);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  // S-KEU-3: GET /siswa/info-pembayaran
  async getInfoPembayaran(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const data = await keuanganService.getInfoPembayaran(userId);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  // S-KEU-4: POST /siswa/pembayaran
  async createPembayaran(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new BadRequestError('Bukti pembayaran (JPG/PNG) wajib diupload');
      }
      const userId = req.user!.userId;
      const { tagihanId, nominal, tanggalTransfer } = req.body;

      const data = await keuanganService.createPembayaran(
        userId,
        tagihanId,
        parseFloat(nominal),
        tanggalTransfer,
        req.file
      );
      res.status(201).json({ data });
    } catch (err) {
      next(err);
    }
  }

  // G-KEU-1: GET /guru/kelas/:kelasId/tagihan/status?page=&limit=
  async getStatusPembayaranKelas(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { kelasId } = req.params;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;

      const result = await keuanganService.getStatusPembayaranKelas(userId, kelasId, page, limit);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const keuanganController = new KeuanganController();
