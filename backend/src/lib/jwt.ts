import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

export interface JwtPayload {
  sub: string;    // user id
  email: string;
  iat?: number;
  exp?: number;
}

export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function generateRefreshToken(): string {
  return randomBytes(64).toString('hex');
}

export function getRefreshTokenExpiry(): Date {
  const d = new Date();
  const days = parseInt(JWT_REFRESH_EXPIRES_IN.replace('d', '') || '30', 10);
  d.setDate(d.getDate() + days);
  return d;
}

export function getPasswordResetExpiry(): Date {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 30); // 30 minutes
  return d;
}
