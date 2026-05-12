import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { UserProfileDto } from './dto';
import { SumobAuthGuard } from '../sumob-auth/sumob-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import type { RequestUser } from './decorators/current-user.decorator';

/**
 * SUMOB entegrasyonu sonrası: `/auth/login` ve `/auth/logout` kaldırıldı.
 * Mobile, isteklerini `userKey` + `deviceKey` header’ları ile gönderir;
 * doğrulama `SumobAuthGuard` üzerinden `sp_find_user` çağrısı ile yapılır.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('me')
  @UseGuards(SumobAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Oturumdaki kullanıcı bilgisi (SUMOB userKey/deviceKey ile)',
  })
  @ApiResponse({
    status: 200,
    description: 'Kullanıcı profili',
    type: UserProfileDto,
  })
  @ApiResponse({ status: 401, description: 'SUMOB oturumu geçersiz' })
  async getMe(@CurrentUser() user: RequestUser): Promise<UserProfileDto> {
    return this.authService.getProfile(user.id);
  }
}
