import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../database/entities';
import { AdminService } from './admin.service';
import {
  CreateSpecialPeriodDto,
  ToggleSpecialPeriodDto,
  UpdateSpecialPeriodDto,
} from './dto/manage-special-period.dto';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // ── Kullanıcı yönetimi YOK ───────────────────────────────────
  // Kullanıcı bilgileri ve oturumu SUMOB mobil DB tarafından yönetilir.
  // Library API yalnızca rezervasyon işlemlerini kapsar.

  // ── Reservations ───────────────────────────────────────────

  @Get('reservations')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Tüm rezervasyonlar (yönetici / personel, salt okuma listesi)' })
  @ApiQuery({ name: 'status', required: false, description: 'active|cancelled|completed|no_show|expired' })
  @ApiQuery({ name: 'studentQuery', required: false, description: 'Öğrenci numarası araması' })
  @ApiQuery({ name: 'searchStudentNumber', required: false, description: 'Öğrenci numarası araması (alias)' })
  @ApiQuery({ name: 'nameQuery', required: false, description: 'Ad soyad araması' })
  @ApiQuery({ name: 'searchFullName', required: false, description: 'Ad soyad araması (alias)' })
  @ApiQuery({ name: 'dateYmd', required: false, description: 'Rezervasyon tarihi YYYY-MM-DD' })
  @ApiQuery({ name: 'date', required: false, description: 'Rezervasyon tarihi YYYY-MM-DD (alias)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  async getReservations(
    @Query('status') status?: string,
    @Query('studentQuery') studentQuery?: string,
    @Query('searchStudentNumber') searchStudentNumber?: string,
    @Query('nameQuery') nameQuery?: string,
    @Query('searchFullName') searchFullName?: string,
    @Query('dateYmd') dateYmd?: string,
    @Query('date') date?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getReservations({
      status,
      studentQuery,
      searchStudentNumber,
      nameQuery,
      searchFullName,
      dateYmd,
      date,
      page,
      limit,
    });
  }

  @Delete('reservations/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Rezervasyonu admin olarak iptal et' })
  async adminCancelReservation(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.adminCancelReservation(id);
  }

  // ── Halls / Tables ─────────────────────────────────────────

  @Get('halls')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Salon listesi (yönetici / personel)' })
  async getHalls() {
    return this.adminService.getHalls();
  }

  @Get('halls/:id/tables')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Salon masaları (yönetici / personel)' })
  async getHallTables(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getHallTables(id);
  }

  @Patch('tables/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Masa bilgilerini güncelle (admin)' })
  async updateTable(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { positionX?: number; positionY?: number; width?: number; height?: number; featureIds?: string[] },
  ) {
    return this.adminService.updateTable(id, body);
  }

  // ── Statistics ─────────────────────────────────────────────

  @Get('statistics/overview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Genel istatistik özeti (yönetici / personel)' })
  async getOverview() {
    return this.adminService.getOverview();
  }

  // ── Special Periods ────────────────────────────────────────

  @Get('special-periods')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.STAFF)
  @ApiOperation({ summary: 'Özel dönemleri listele (yönetici / personel)' })
  async getSpecialPeriods() {
    return this.adminService.getSpecialPeriods();
  }

  @Post('special-periods')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Özel dönem oluştur (admin)' })
  async createSpecialPeriod(@Body() dto: CreateSpecialPeriodDto) {
    return this.adminService.createSpecialPeriod(dto);
  }

  @Patch('special-periods/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Özel dönem güncelle (admin)' })
  async updateSpecialPeriod(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSpecialPeriodDto,
  ) {
    return this.adminService.updateSpecialPeriod(id, dto);
  }

  @Patch('special-periods/:id/status')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Özel dönemi aktif/pasif yap (admin)' })
  async toggleSpecialPeriod(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleSpecialPeriodDto,
  ) {
    return this.adminService.toggleSpecialPeriod(id, dto);
  }

  @Delete('special-periods/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiOperation({ summary: 'Özel dönemi sil (admin)' })
  async deleteSpecialPeriod(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteSpecialPeriod(id);
  }
}
