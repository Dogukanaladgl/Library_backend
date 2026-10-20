import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserProfileDto } from '../auth/dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/decorators/current-user.decorator';
import type { UserRole } from '../../database/entities';
import { OrtakWebJwtGuard } from './guards/ortak-web-jwt.guard';
import { ORTAK_WEB_SWAGGER_TAG } from './ortak-web.constants';

@ApiTags(ORTAK_WEB_SWAGGER_TAG)
@ApiBearerAuth()
@UseGuards(OrtakWebJwtGuard)
@Controller('web')
export class OrtakWebMeController {
  @Get('me')
  @ApiOperation({
    summary: 'Ortak-login-web oturum profili (University JWT)',
  })
  @ApiResponse({ status: 200, type: UserProfileDto })
  @ApiResponse({ status: 401, description: 'University JWT geçersiz' })
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
