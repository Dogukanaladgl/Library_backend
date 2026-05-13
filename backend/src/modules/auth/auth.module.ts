import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';

/**
 * SUMOB entegrasyonu sonrası JWT / Passport / UserSession / library profil
 * okuma mantığı tamamen kaldırıldı. Kimlik doğrulama [SumobAuthModule]
 * üzerinden header tabanlı yapılır; `/auth/me` SUMOB sonucunu olduğu gibi
 * döner.
 */
@Module({
  controllers: [AuthController],
})
export class AuthModule {}
