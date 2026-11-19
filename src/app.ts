import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { errorHandler } from './middlewares/errorHandler.js';
import { NotFoundError } from './utils/errors.js';
import siswaRouter from './routes/siswa.routes.js';
import guruRouter from './routes/guru.routes.js';

export function createApp(): Application {
  const app = express();

  // Percayai 1 hop reverse proxy terdepan (Render / Cloudflare / Nginx)
  app.set('trust proxy', 1);

  // 1. Security & Parsers
  app.use(helmet());
  app.use(cors());

  // Rate Limiting
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 menit
    max: 1000, // Batas request per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Terlalu banyak permintaan, silakan coba lagi beberapa saat lagi.',
      },
    },
  });
  app.use(limiter);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 2. Health check route
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 3. Mount API v1 Routes
  const apiV1 = express.Router();
  apiV1.use('/siswa', siswaRouter);
  apiV1.use('/guru', guruRouter);

  app.use('/api/v1', apiV1);

  // 4. 404 Handler for undefined routes
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError('Endpoint tidak ditemukan'));
  });

  // 5. Central Error Handler
  app.use(errorHandler);

  return app;
}
