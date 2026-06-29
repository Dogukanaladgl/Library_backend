import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '../../../database/entities';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';
import { SelcukApiService } from '../../selcuk-api/selcuk-api.service';
import { PanelSessionService } from '../panel-session.service';

/**
 * Panel Bearer JWT sonrası: sunucudaki üniversite token ile
 * IsAuthenticate + HasPermission (rol bazlı) kontrolü.
 * SUMOB mobil yolunda çalışmaz — yalnızca DualAuthGuard panel dalında çağrılır.
 */
@Injectable()
export class PanelUniversityGuard implements CanActivate {
  constructor(
    private readonly panelSessions: PanelSessionService,
    private readonly selcukApi: SelcukApiService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = req.user;

    if (!user?.id) {
      throw new UnauthorizedException('Panel oturumu geçersiz.');
    }

    const role = user.role as UserRole;
    if (role !== UserRole.ADMIN && role !== UserRole.STAFF) {
      throw new ForbiddenException('Panel erişim yetkisi yok.');
    }

    const session = this.panelSessions.get(user.id);
    if (!session) {
      throw new UnauthorizedException(
        'Üniversite oturumu bulunamadı. Lütfen tekrar giriş yapın.',
      );
    }

    try {
      await this.selcukApi.assertUniversityAccessForRole(
        session.universityAccessToken,
        role,
      );
      return true;
    } catch (error) {
      this.panelSessions.delete(user.id);
      throw error;
    }
  }
}
