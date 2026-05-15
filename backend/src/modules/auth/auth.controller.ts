import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { UserProfileDto } from './dto';
import { SumobAuthGuard } from '../sumob-auth/sumob-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { RequestUser } from './decorators/current-user.decorator';
import type { UserRole } from '../../database/entities';

/**
 * SUMOB entegrasyonu sonrası: `/auth/login` ve `/auth/logout` kaldırıldı.
 * Mobile, isteklerini `userKey` + `deviceKey` header’ları ile gönderir;
 * doğrulama `SumobAuthGuard` üzerinden `sp_find_user` çağrısı ile yapılır.
 * Profil verisi her istekte SUMOB'tan tazelenir; library DB'de saklanmaz.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  @Get('me')
  @UseGuards(SumobAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Oturumdaki kullanıcı bilgisi (SUMOB userKey/deviceKey ile)',
  })
  @ApiResponse({
    status: 200,
    description: 'Kullanıcı profili (SUMOB anlık)',
    type: UserProfileDto,
  })
  @ApiResponse({ status: 401, description: 'SUMOB oturumu geçersiz' })
  getMe(@CurrentUser() user: RequestUser): UserProfileDto {
    return {
      id: user.id,
      studentNumber: user.studentNumber,
      fullName: user.fullName,
      role: user.role as UserRole,
      email: user.email ?? null,
      facultyName: user.facultyName ?? null,
      departmentName: user.departmentName ?? null,
      isSuperAdmin: !!user.isSuperAdmin,
      isStaffMember: !!user.isStaffMember,
    };
  }
}
