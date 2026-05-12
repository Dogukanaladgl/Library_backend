import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SumobAuthService } from './sumob-auth.service';

/**
 * Header’dan `userKey` + `deviceKey` okur ve [SumobAuthService] üzerinden
 * SUMOB mobil DB doğrulaması yapar. Başarılıysa `request.user`’ı set eder
 * (RequestUser uyumlu: id/studentNumber/role).
 *
 * Desteklenen header isimleri (case-insensitive):
 *  - `userKey`            (publicapiservices stili)
 *  - `X-Sumob-User-Key`   (mobile client’ta hâlihazırda gönderiliyor)
 *  - `deviceKey`
 *  - `X-Sumob-Device-Key`
 */
@Injectable()
export class SumobAuthGuard implements CanActivate {
  constructor(private readonly sumobAuth: SumobAuthService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: unknown }>();
    const userKey = pickHeader(req, ['userkey', 'x-sumob-user-key']);
    const deviceKey = pickHeader(req, ['devicekey', 'x-sumob-device-key']);

    if (!userKey || !deviceKey) {
      throw new UnauthorizedException(
        'SUMOB oturum bilgileri eksik (userKey/deviceKey header gerekli).',
      );
    }

    const resolved = await this.sumobAuth.resolve(deviceKey, userKey);
    // RequestUser uyumlu (id, studentNumber, role) + ek alanlar.
    (req as any).user = {
      id: resolved.id,
      studentNumber: resolved.studentNumber,
      role: resolved.role,
      fullName: resolved.fullName,
      isSuperAdmin: resolved.isSuperAdmin,
      sumobUserKey: resolved.sumobUserKey,
      sumobUserId: resolved.sumobUserId,
    };
    return true;
  }
}

function pickHeader(req: Request, names: string[]): string | undefined {
  for (const n of names) {
    const v = req.headers[n];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (Array.isArray(v) && v.length > 0 && v[0]?.trim()) return v[0].trim();
  }
  return undefined;
}
