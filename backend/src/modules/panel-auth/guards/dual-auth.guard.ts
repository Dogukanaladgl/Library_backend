import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SumobAuthGuard } from '../../sumob-auth/sumob-auth.guard';
import { PanelJwtGuard } from './panel-jwt.guard';
import { PanelUniversityGuard } from './panel-university.guard';

function hasBearerToken(req: Request): boolean {
  const auth = req.headers.authorization;
  return typeof auth === 'string' && auth.startsWith('Bearer ');
}

function hasSumobHeaders(req: Request): boolean {
  const userKey =
    pickHeader(req, ['userkey', 'x-sumob-user-key']) ?? '';
  const deviceKey =
    pickHeader(req, ['devicekey', 'x-sumob-device-key']) ?? '';
  return Boolean(userKey && deviceKey);
}

function pickHeader(req: Request, names: string[]): string | undefined {
  for (const n of names) {
    const v = req.headers[n];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (Array.isArray(v) && v.length > 0 && v[0]?.trim()) return v[0].trim();
  }
  return undefined;
}

/**
 * İki kanallı kimlik doğrulama:
 * - Web panel → Authorization: Bearer (kütüphane JWT)
 * - SUMOB mobil → userKey + deviceKey (değişmez)
 */
@Injectable()
export class DualAuthGuard implements CanActivate {
  constructor(
    private readonly panelJwtGuard: PanelJwtGuard,
    private readonly panelUniversityGuard: PanelUniversityGuard,
    private readonly sumobAuthGuard: SumobAuthGuard,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();

    if (hasBearerToken(req)) {
      const jwtOk = await this.panelJwtGuard.canActivate(ctx);
      if (jwtOk !== true) {
        return false;
      }
      return this.panelUniversityGuard.canActivate(ctx);
    }

    if (hasSumobHeaders(req)) {
      return this.sumobAuthGuard.canActivate(ctx);
    }

    throw new UnauthorizedException(
      'Kimlik doğrulama gerekli. Panel için Bearer token veya SUMOB oturum headerları gönderin.',
    );
  }
}
