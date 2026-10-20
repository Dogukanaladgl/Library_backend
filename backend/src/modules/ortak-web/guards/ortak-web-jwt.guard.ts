import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';
import { SelcukApiService } from '../../selcuk-api/selcuk-api.service';
import { OrtakWebUserService } from '../ortak-web-user.service';

/**
 * Ortak-login-web: `Authorization: Bearer <University JWT>` (cookie `selcuk_jwt`).
 * Kütüphane secret'ı ile verify edilmez; üniversite IsAuthenticate + GetProfile.
 * Mevcut DualAuthGuard / SUMOB yollarına dokunmaz.
 */
@Injectable()
export class OrtakWebJwtGuard implements CanActivate {
  constructor(
    private readonly selcukApi: SelcukApiService,
    private readonly webUsers: OrtakWebUserService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx
      .switchToHttp()
      .getRequest<Request & { user?: RequestUser }>();
    const token = extractBearer(req);
    if (!token) {
      throw new UnauthorizedException(
        'Kimlik doğrulama gerekli. Authorization: Bearer <selcuk_jwt> gönderin.',
      );
    }

    const authenticated = await this.selcukApi.isAuthenticate(token);
    if (!authenticated) {
      throw new UnauthorizedException(
        'Üniversite oturumu geçersiz veya süresi dolmuş.',
      );
    }

    const profile = await this.selcukApi.getProfile(token);
    if (!profile) {
      throw new UnauthorizedException('Üniversite profili alınamadı.');
    }

    req.user = await this.webUsers.fromUniversityProfile(profile);
    return true;
  }
}

function extractBearer(req: Request): string | null {
  const auth = req.headers.authorization;
  if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
    return null;
  }
  const token = auth.slice(7).trim();
  return token || null;
}
