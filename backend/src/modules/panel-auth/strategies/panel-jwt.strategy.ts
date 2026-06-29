import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { User } from '../../../database/entities';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';
import type { PanelJwtPayload } from '../panel-auth.types';

/**
 * Authorization: Bearer <panel-jwt> header'ından token okur,
 * imzayı JWT_SECRET ile doğrular ve request.user doldurur.
 */
@Injectable()
export class PanelJwtStrategy extends PassportStrategy(Strategy, 'panel-jwt') {
  constructor(
    config: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('app.jwtSecret') ?? 'dev-panel-jwt-secret',
    });
  }

  async validate(payload: PanelJwtPayload): Promise<RequestUser> {
    if (payload.type !== 'panel') {
      throw new UnauthorizedException('Geçersiz panel oturumu.');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Kullanıcı bulunamadı veya devre dışı.');
    }

    return {
      id: user.id,
      studentNumber: user.studentNumber,
      role: payload.role,
      fullName: user.fullName,
      email: null,
      facultyName: null,
      departmentName: null,
      isSuperAdmin: user.isSuperAdmin,
      isStaffMember: user.isStaffMember,
    };
  }
}
