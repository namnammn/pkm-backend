import { Request, Response, NextFunction } from 'express';
import { pklService } from '../services/pkl.service.js';
import { BadRequestError } from '../utils/errors.js';
import path from 'path';

export class PklController {
  // S-PKL-1: GET /siswa/pkl
  async getStatusPkl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const data = await pklService.getStatusPkl(userId);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  // S-PKL-2: GET /siswa/pkl/nilai
  async getNilaiPkl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const data = await pklService.getNilaiPkl(userId);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  // S-PKL-3: POST /siswa/pkl/laporan
  async uploadLaporan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new BadRequestError('File laporan PDF wajib diupload');
      }
      const userId = req.user!.userId;
      const result = await pklService.uploadLaporan(userId, req.file);
      res.status(result.isNew ? 201 : 200).json({ data: result.data });
    } catch (err) {
      next(err);
    }
  }

  // G-PKL-1: GET /guru/pkl/siswa
  async getSiswaBimbingan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;

      const result = await pklService.getSiswaBimbingan(userId, page, limit);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  // G-PKL-2: GET /guru/pkl/laporan/:id
  async getLaporanDetail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const acceptHeader = req.headers.accept;

      const result = await pklService.getLaporanDetail(userId, id, acceptHeader);
      if (result.isStream && result.filePath) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${result.fileName}"`);
        res.sendFile(path.resolve(result.filePath));
        return;
      }

      res.status(200).json({ data: result.data });
    } catch (err) {
      next(err);
    }
  }

  // G-PKL-3: PATCH /guru/pkl/laporan/:id/review
  async reviewLaporan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;
      const { status, catatan } = req.body;

      const data = await pklService.reviewLaporan(userId, id, status, catatan);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  // G-PKL-4: PUT /guru/pkl/siswa/:siswaId/nilai
  async inputNilaiPkl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { siswaId } = req.params;
      const { nilaiSekolah, nilaiIndustri } = req.body;

      const data = await pklService.inputNilaiPkl(userId, siswaId, nilaiSekolah, nilaiIndustri);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }
}

export const pklController = new PklController();
