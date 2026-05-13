import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ReservationsService } from './reservations.service';
import { CheckInService } from './check-in.service';
import { SumobAuthService } from '../sumob-auth/sumob-auth.service';
import {
  CreateReservationDto,
  CancelReservationDto,
  CheckInDto,
  ReservationResponseDto,
  CheckInResponseDto,
  UserReservationStatusDto,
  MessageResponseDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/decorators/current-user.decorator';

@ApiTags('reservations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(
    private readonly reservationsService: ReservationsService,
    private readonly checkInService: CheckInService,
    private readonly sumobAuth: SumobAuthService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Yeni rezervasyon olustur (yalnizca ayni gun)' })
  @ApiResponse({ status: 201, description: 'Rezervasyon olusturuldu', type: ReservationResponseDto })
  @ApiResponse({ status: 400, description: 'Gecersiz istek' })
  @ApiResponse({ status: 409, description: 'Cakisma (aktif rezervasyon veya masa dolu)' })
  async create(
    @CurrentUser() user: RequestUser,
    @Body() createDto: CreateReservationDto,
  ) {
    // Rezervasyon FK için library satırı lazy provision edilir; library DB'de
    // user yönetimi yapılmaz, SADECE rezervasyona referans için satır vardır.
    const userId =
      user.id || (await this.sumobAuth.ensureLibraryUserId(user.studentNumber));
    return this.reservationsService.create(userId, createDto);
  }

  @Get('my')
  @ApiOperation({ summary: 'Kullanicinin tum rezervasyonlarini getir' })
  @ApiResponse({ status: 200, type: [ReservationResponseDto] })
  async findMyReservations(@CurrentUser() user: RequestUser) {
    return this.reservationsService.findByUser(user.id);
  }

  @Get('my/history')
  @ApiOperation({ summary: 'Kullanicinin tum rezervasyon gecmisini getir' })
  @ApiResponse({ status: 200, type: [ReservationResponseDto] })
  async findMyHistory(@CurrentUser() user: RequestUser) {
    return this.reservationsService.findHistoryByUser(user.id);
  }

  @Get('my/active')
  @ApiOperation({ summary: 'Kullanicinin aktif rezervasyonunu getir' })
  @ApiResponse({ status: 200, type: ReservationResponseDto })
  @ApiResponse({ status: 200, description: 'Aktif rezervasyon yok (null doner)' })
  async findMyActiveReservation(@CurrentUser() user: RequestUser) {
    const reservation = await this.reservationsService.findActiveReservation(user.id);
    if (!reservation) {
      return null;
    }
    return reservation;
  }

  @Get('my/status')
  @ApiOperation({ summary: 'Kullanicinin bugunki rezervasyon durumunu getir' })
  @ApiResponse({ status: 200, type: UserReservationStatusDto })
  async getMyStatus(@CurrentUser() user: RequestUser) {
    return this.reservationsService.getUserReservationStatus(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Rezervasyon detayini getir' })
  @ApiResponse({ status: 200, type: ReservationResponseDto })
  @ApiResponse({ status: 404, description: 'Rezervasyon bulunamadi' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservationsService.findOne(id);
  }

  // --- Check-in Endpoints ---

  @Post('check-in')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'QR kod + konum ile check-in yap (reservationId gerekmez)',
    description:
      'Kullanicinin aktif RESERVED rezervasyonunu otomatik bulur ve check-in yapar. ' +
      'QR kodu rezervasyon yapilan masaninkiyle eslesmelidir. ' +
      'Konum kutuphane binasina 50m mesafe icinde olmalidir.',
  })
  @ApiResponse({ status: 200, description: 'Check-in basarili', type: CheckInResponseDto })
  @ApiResponse({ status: 400, description: 'Gecersiz QR kod / konum uzak / sure dolmus' })
  @ApiResponse({ status: 404, description: 'Aktif rezervasyon bulunamadi' })
  async checkInByQr(
    @CurrentUser() user: RequestUser,
    @Body() checkInDto: CheckInDto,
  ) {
    return this.checkInService.checkInByQr(user.id, checkInDto);
  }

  @Post(':id/check-in')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Belirli rezervasyon icin QR kod + konum ile check-in yap',
    description:
      'Verilen rezervasyon ID ile check-in yapar. ' +
      'Kullanici yalnizca kendi rezervasyonu icin check-in yapabilir. ' +
      'Rezervasyon RESERVED durumunda olmalidir. ' +
      'QR kodu masaninkiyle eslesmelidir. ' +
      'Konum kutuphane binasina 50m mesafe icinde olmalidir.',
  })
  @ApiResponse({ status: 200, description: 'Check-in basarili', type: CheckInResponseDto })
  @ApiResponse({ status: 400, description: 'Gecersiz QR kod / konum uzak / sure dolmus / zaten check-in yapilmis' })
  @ApiResponse({ status: 403, description: 'Baska kullanicinin rezervasyonu' })
  @ApiResponse({ status: 404, description: 'Rezervasyon bulunamadi' })
  async checkIn(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
    @Body() checkInDto: CheckInDto,
  ) {
    return this.checkInService.checkIn(id, user.id, checkInDto);
  }

  @Post('validate-qr')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'QR kod dogrula (masa bilgisi doner)' })
  @ApiResponse({ status: 200, description: 'QR dogrulama sonucu' })
  async validateQr(@Body('qrCode') qrCode: string) {
    return this.checkInService.validateQrCode(qrCode);
  }

  // --- Extend / Cancel ---

  @Put(':id/extend')
  @ApiOperation({ summary: 'Rezervasyonu 1 saat uzat (maks 2 kez)' })
  @ApiResponse({ status: 200, description: 'Uzatma basarili', type: ReservationResponseDto })
  @ApiResponse({ status: 400, description: 'Uzatma kosullari karsilanmiyor' })
  @ApiResponse({ status: 409, description: 'Zaman araligi cakismasi' })
  async extend(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.reservationsService.extend(id, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Rezervasyonu iptal et' })
  @ApiResponse({ status: 200, description: 'Iptal basarili', type: ReservationResponseDto })
  @ApiResponse({ status: 400, description: 'Iptal edilemez durum' })
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
    @Body() cancelDto: CancelReservationDto,
  ) {
    return this.reservationsService.cancel(id, user.id, cancelDto?.reason);
  }
}
