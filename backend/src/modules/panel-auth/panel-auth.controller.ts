import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserProfileDto } from '../auth/dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/decorators/current-user.decorator';
import { PanelLoginDto } from './dto/panel-login.dto';
import {
  PanelLoginResponseDto,
  PanelMessageResponseDto,
} from './dto/panel-login-response.dto';
import { PanelJwtGuard } from './guards/panel-jwt.guard';
import { PanelUniversityGuard } from './guards/panel-university.guard';
import { PanelAuthService } from './panel-auth.service';

@ApiTags('auth')
@Controller('auth/panel')
export class PanelAuthController {
  constructor(private readonly panelAuth: PanelAuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Web panel girişi (apiservices + kütüphane JWT)',
    description:
      'Auth/Login, IsAuthenticate ve HasPermission ile rol belirlenir. ' +
      'Yalnızca panel accessToken döner; üniversite tokenı sunucu oturumunda kalır.',
  })
  @ApiResponse({ status: 200, type: PanelLoginResponseDto })
  @ApiResponse({ status: 401, description: 'Hatalı kullanıcı adı veya şifre' })
  @ApiResponse({ status: 403, description: 'Panel erişim yetkisi yok' })
  login(@Body() dto: PanelLoginDto): Promise<PanelLoginResponseDto> {
    return this.panelAuth.login(dto);
  }

  @Post('logout')
  @UseGuards(PanelJwtGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Panel oturumunu kapat' })
  @ApiResponse({ status: 200, type: PanelMessageResponseDto })
  logout(@CurrentUser() user: RequestUser): PanelMessageResponseDto {
    this.panelAuth.logout(user.id);
    return { message: 'Oturum kapatıldı.' };
  }

  @Get('me')
  @UseGuards(PanelJwtGuard, PanelUniversityGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Panel oturumundaki kullanıcı',
    description:
      'Her çağrıda IsAuthenticate ve HasPermission kontrol edilir.',
  })
  @ApiResponse({ status: 200, type: UserProfileDto })
  getPanelMe(@CurrentUser() user: RequestUser): UserProfileDto {
    return {
      id: user.id,
      studentNumber: user.studentNumber,
      fullName: user.fullName,
      role: user.role as UserProfileDto['role'],
      email: user.email ?? null,
      facultyName: user.facultyName ?? null,
      departmentName: user.departmentName ?? null,
      isSuperAdmin: !!user.isSuperAdmin,
      isStaffMember: !!user.isStaffMember,
    };
  }
}
