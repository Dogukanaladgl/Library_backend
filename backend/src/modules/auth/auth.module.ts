import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';

/**
 * SUMOB entegrasyonu sonrası JWT / Passport / UserSession bağımlılığı kaldırıldı.
 * Kimlik doğrulama [SumobAuthModule] üzerinden header tabanlı yapılıyor.
 */
@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
