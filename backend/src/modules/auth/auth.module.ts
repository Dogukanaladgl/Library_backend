import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { PanelAuthModule } from '../panel-auth/panel-auth.module';

/**
 * `/auth/me` → DualAuthGuard (SUMOB header veya panel Bearer JWT).
 * Panel login → [PanelAuthModule] `/auth/panel/login`.
 */
@Module({
  imports: [PanelAuthModule],
  controllers: [AuthController],
})
export class AuthModule {}
