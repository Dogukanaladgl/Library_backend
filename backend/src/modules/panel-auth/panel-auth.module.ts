import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../database/entities';
import { SelcukApiModule } from '../selcuk-api/selcuk-api.module';
import { PanelAuthController } from './panel-auth.controller';
import { PanelAuthService } from './panel-auth.service';
import { PanelSessionService } from './panel-session.service';
import { DualAuthGuard } from './guards/dual-auth.guard';
import { PanelJwtGuard } from './guards/panel-jwt.guard';
import { PanelUniversityGuard } from './guards/panel-university.guard';
import { PanelJwtStrategy } from './strategies/panel-jwt.strategy';

@Module({
  imports: [
    SelcukApiModule,
    PassportModule.register({ defaultStrategy: 'panel-jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('app.jwtSecret') ?? 'dev-panel-jwt-secret',
        signOptions: {
          expiresIn: config.get<string>('app.jwtExpiresIn', '8h') as '8h',
        },
      }),
    }),
    TypeOrmModule.forFeature([User]),
  ],
  controllers: [PanelAuthController],
  providers: [
    PanelAuthService,
    PanelSessionService,
    PanelJwtStrategy,
    PanelJwtGuard,
    PanelUniversityGuard,
    DualAuthGuard,
  ],
  exports: [
    PanelAuthService,
    PanelSessionService,
    PanelJwtGuard,
    PanelUniversityGuard,
    DualAuthGuard,
    JwtModule,
  ],
})
export class PanelAuthModule {}
