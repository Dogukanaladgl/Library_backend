import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';

/**
 * SUMOB entegrasyonu sonrası login/logout/JWT mantığı kaldırıldı.
 * Burada yalnızca `/auth/me` çağrısı için profil okuma kaldı.
 */
@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Kullanıcı bulunamadı.');
    }

    return {
      id: user.id,
      studentNumber: user.studentNumber,
      fullName: user.fullName,
      role: user.role,
    };
  }
}
