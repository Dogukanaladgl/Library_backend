import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { HallAvailabilityService } from '../hall-availability/hall-availability.service';
import {
  CreateAvailabilityExceptionDto,
  CreateHallClosureDto,
  CreateLibraryClosureDto,
} from '../hall-availability/dto/manage-availability.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/decorators/current-user.decorator';
import {
  CreateSpecialPeriodDto,
  ToggleSpecialPeriodDto,
  UpdateSpecialPeriodDto,
} from './dto/manage-special-period.dto';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly hallAvailabilityService: HallAvailabilityService,
  ) {}

  // ── Staff Members (yarı zamanlı salon görevlileri) ─────────

  @Get('staff-members')
  @ApiOperation({ summary: 'Salon görevlisi olarak işaretli kullanıcılar' })
  async listStaffMembers() {
    return this.adminService.listStaffMembers();
  }

  @Post('staff-members')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Bir kurumNo için salon görevlisi (staff) yetkisi ver',
  })
  async addStaffMember(@Body() body: { studentNumber: string }) {
    return this.adminService.addStaffMember(body?.studentNumber);
  }

  @Delete('staff-members/:studentNumber')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'KurumNo için salon görevlisi yetkisini kaldır',
  })
  async removeStaffMember(@Param('studentNumber') studentNumber: string) {
    await this.adminService.removeStaffMember(studentNumber);
    return { message: 'Görevli yetkisi kaldırıldı.' };
  }

  // ── Reservations ───────────────────────────────────────────

  @Get('reservations')
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
  @ApiOperation({ summary: 'Rezervasyonu admin olarak iptal et' })
  async adminCancelReservation(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.adminCancelReservation(id);
  }

  // ── Halls / Tables ─────────────────────────────────────────

  @Get('halls')
  @ApiOperation({ summary: 'Salon listesi (yönetici / personel)' })
  async getHalls() {
    return this.adminService.getHalls();
  }

  @Get('halls/:id/tables')
  @ApiOperation({ summary: 'Salon masaları (yönetici / personel)' })
  async getHallTables(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getHallTables(id);
  }

  @Patch('tables/:id')
  @ApiOperation({ summary: 'Masa bilgilerini güncelle (admin)' })
  async updateTable(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { positionX?: number; positionY?: number; width?: number; height?: number; featureIds?: string[] },
  ) {
    return this.adminService.updateTable(id, body);
  }

  // ── Salon saat ayarlari / kapatmalar ───────────────────────

  @Get('halls/:id/availability-exceptions')
  @ApiOperation({ summary: 'Salon saatlik acik/kapali ayarlari (admin)' })
  @ApiQuery({ name: 'date', required: false, description: 'YYYY-MM-DD' })
  async listAvailabilityExceptions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('date') date?: string,
  ) {
    const rows = await this.hallAvailabilityService.listAvailabilityExceptions(
      id,
      date,
    );
    return rows.map((r) =>
      this.hallAvailabilityService.formatExceptionResponse(r),
    );
  }

  @Post('halls/:id/availability-exceptions')
  @ApiOperation({
    summary: 'Salon icin saatlik acik/kapali ayari olustur (admin, en az 1 gun onceden)',
  })
  async createAvailabilityException(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateAvailabilityExceptionDto,
    @CurrentUser() user?: RequestUser,
  ) {
    const row = await this.hallAvailabilityService.createAvailabilityException(
      id,
      dto,
      user?.id ?? null,
    );
    return this.hallAvailabilityService.formatExceptionResponse(row);
  }

  @Delete('halls/:id/availability-exceptions/:exceptionId')
  @ApiOperation({ summary: 'Salon saat ayarini sil (admin)' })
  async deleteAvailabilityException(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('exceptionId', ParseUUIDPipe) exceptionId: string,
  ) {
    await this.hallAvailabilityService.deleteAvailabilityException(id, exceptionId);
    return { message: 'Saat ayari kaldirildi.' };
  }

  @Get('halls/:id/closures')
  @ApiOperation({ summary: 'Salon kapatma kayitlari (admin)' })
  @ApiQuery({ name: 'startDate', required: false })
  @ApiQuery({ name: 'endDate', required: false })
  async listHallClosures(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const rows = await this.hallAvailabilityService.listHallClosures(
      id,
      startDate,
      endDate,
    );
    return rows.map((r) => this.hallAvailabilityService.formatClosureResponse(r));
  }

  @Post('halls/:id/closures')
  @ApiOperation({
    summary: 'Salonu tarih araliginda kapat (admin, en az 1 gun onceden)',
  })
  async createHallClosure(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateHallClosureDto,
    @CurrentUser() user?: RequestUser,
  ) {
    const row = await this.hallAvailabilityService.createHallClosure(
      id,
      dto,
      user?.id ?? null,
    );
    return this.hallAvailabilityService.formatClosureResponse(row);
  }

  @Delete('halls/:id/closures/:closureId')
  @ApiOperation({ summary: 'Salon kapatma kaydini sil (admin)' })
  async deleteHallClosure(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('closureId', ParseUUIDPipe) closureId: string,
  ) {
    await this.hallAvailabilityService.deleteHallClosure(id, closureId);
    return { message: 'Kapatma kaydi kaldirildi.' };
  }

  @Post('closures')
  @ApiOperation({
    summary: 'Kutuphane veya salon kapatmasi olustur (admin)',
    description: 'hallId verilmezse tum kutuphane kapanir.',
  })
  async createLibraryClosure(
    @Body() dto: CreateLibraryClosureDto,
    @CurrentUser() user?: RequestUser,
  ) {
    const { hallId, ...closureDto } = dto;
    const row = await this.hallAvailabilityService.createHallClosure(
      hallId ?? null,
      closureDto,
      user?.id ?? null,
    );
    return this.hallAvailabilityService.formatClosureResponse(row);
  }

  // ── Statistics ─────────────────────────────────────────────

  @Get('statistics/overview')
  @ApiOperation({ summary: 'Genel istatistik özeti (yönetici / personel)' })
  async getOverview() {
    return this.adminService.getOverview();
  }

  // ── Special Periods ────────────────────────────────────────

  @Get('special-periods')
  @ApiOperation({ summary: 'Özel dönemleri listele (yönetici / personel)' })
  async getSpecialPeriods() {
    return this.adminService.getSpecialPeriods();
  }

  @Post('special-periods')
  @ApiOperation({ summary: 'Özel dönem oluştur (admin)' })
  async createSpecialPeriod(@Body() dto: CreateSpecialPeriodDto) {
    return this.adminService.createSpecialPeriod(dto);
  }

  @Patch('special-periods/:id')
  @ApiOperation({ summary: 'Özel dönem güncelle (admin)' })
  async updateSpecialPeriod(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSpecialPeriodDto,
  ) {
    return this.adminService.updateSpecialPeriod(id, dto);
  }

  @Patch('special-periods/:id/status')
  @ApiOperation({ summary: 'Özel dönemi aktif/pasif yap (admin)' })
  async toggleSpecialPeriod(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleSpecialPeriodDto,
  ) {
    return this.adminService.toggleSpecialPeriod(id, dto);
  }

  @Delete('special-periods/:id')
  @ApiOperation({ summary: 'Özel dönemi sil (admin)' })
  async deleteSpecialPeriod(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.deleteSpecialPeriod(id);
  }
}
