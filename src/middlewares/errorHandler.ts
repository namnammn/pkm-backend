import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors.js';
import { ApiErrorResponse } from '../types/index.js';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Handle custom AppError
  if (err instanceof AppError) {
    const responsePayload: ApiErrorResponse = {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && err.details.length > 0 ? { details: err.details } : {}),
      },
    };
    res.status(err.statusCode).json(responsePayload);
    return;
  }

  // Handle Multer file size error
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    res.status(422).json({
      error: {
        code: 'FILE_TOO_LARGE',
        message: 'Ukuran file melebihi batas maksimum yang diperbolehkan',
      },
    });
    return;
  }

  // Handle JSON parse error from express.json()
  if (err instanceof SyntaxError && 'status' in err && (err as any).status === 400) {
    res.status(400).json({
      error: {
        code: 'BAD_REQUEST',
        message: 'Format JSON pada request body tidak valid',
      },
    });
    return;
  }

  // Default server error
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Kesalahan server tak terduga',
    },
  });
}
