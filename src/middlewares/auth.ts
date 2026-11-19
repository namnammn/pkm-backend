import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import { JwtPayload, UserRole } from '../types/index.js';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Token otentikasi tidak ditemukan');
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    throw new UnauthorizedError('Token tidak valid');
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    req.user = decoded;
    next();
  } catch (err: any) {
    throw new UnauthorizedError('Token tidak valid atau telah kedaluwarsa');
  }
}

export function requireRole(allowedRole: UserRole) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError('Pengguna belum terotentikasi');
    }
    if (req.user.role !== allowedRole) {
      throw new ForbiddenError(`Akses ditolak: Hanya untuk role ${allowedRole}`);
    }
    next();
  };
}
