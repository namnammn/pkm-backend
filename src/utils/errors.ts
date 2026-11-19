import { ApiErrorDetail } from '../types/index.js';

export class AppError extends Error {
  public statusCode: number;
  public code: string;
  public details?: ApiErrorDetail[];

  constructor(statusCode: number, code: string, message: string, details?: ApiErrorDetail[]) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Request cacat atau tipe data tidak terbaca') {
    super(400, 'BAD_REQUEST', message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Token tidak ada, tidak valid, atau kedaluwarsa') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Role salah atau di luar relasi data') {
    super(403, 'FORBIDDEN', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Data tidak ditemukan', code = 'NOT_FOUND') {
    super(404, code, message);
  }
}

export class PklNotFoundError extends AppError {
  constructor(message = 'Siswa belum memiliki penempatan PKL') {
    super(404, 'PKL_NOT_FOUND', message);
  }
}

export class TagihanNotFoundError extends AppError {
  constructor(message = 'Tagihan tidak ditemukan atau bukan milik siswa') {
    super(404, 'TAGIHAN_NOT_FOUND', message);
  }
}

export class ValidationError extends AppError {
  constructor(details: ApiErrorDetail[], message = 'Validasi gagal') {
    super(422, 'VALIDATION_ERROR', message, details);
  }
}

export class BusinessRuleError extends AppError {
  constructor(code: string, message: string) {
    super(422, code, message);
  }
}
