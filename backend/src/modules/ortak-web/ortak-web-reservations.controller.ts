import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { RequestUser } from '../auth/decorators/current-user.decorator';
import {
  CancelReservationDto,
  CreateReservationDto,
  ReservationResponseDto,
  UserReservationStatusDto,
} from '../reservations/dto';
import { ReservationsService } from '../reservations/reservations.service';
import { OrtakWebJwtGuard } from './guards/ortak-web-jwt.guard';
import { ORTAK_WEB_SWAGGER_TAG } from './ortak-web.constants';

@ApiTags(ORTAK_WEB_SWAGGER_TAG)
@ApiBearerAuth()
@UseGuards(OrtakWebJwtGuard)
@Controller('web/reservations')
export class OrtakWebReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Post()
  @ApiOperation({ summary: 'Yeni rezervasyon oluştur (yalnızca aynı gün)' })
  @ApiResponse({ status: 201, type: ReservationResponseDto })
  @ApiResponse({ status: 400, description: 'Geçersiz istek' })
  @ApiResponse({ status: 409, description: 'Çakışma' })
  create(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateReservationDto,
  ) {
    return this.reservationsService.create(user.id, dto);
  }

  @Get('my')
  @ApiOperation({ summary: 'Kullanıcının tüm rezervasyonları' })
  @ApiResponse({ status: 200, type: [ReservationResponseDto] })
  findMine(@CurrentUser() user: RequestUser) {
    return this.reservationsService.findByUser(user.id);
  }

  @Get('my/history')
  @ApiOperation({ summary: 'Rezervasyon geçmişi' })
  @ApiResponse({ status: 200, type: [ReservationResponseDto] })
  history(@CurrentUser() user: RequestUser) {
    return this.reservationsService.findHistoryByUser(user.id);
  }

  @Get('my/active')
  @ApiOperation({ summary: 'Aktif rezervasyon (yoksa null)' })
  @ApiResponse({ status: 200, type: ReservationResponseDto })
  async active(@CurrentUser() user: RequestUser) {
    return (await this.reservationsService.findActiveReservation(user.id)) ?? null;
  }

  @Get('my/status')
  @ApiOperation({ summary: 'Bugünkü rezervasyon durumu' })
  @ApiResponse({ status: 200, type: UserReservationStatusDto })
  status(@CurrentUser() user: RequestUser) {
    return this.reservationsService.getUserReservationStatus(user.id);
  }

  @Put(':id/extend')
  @ApiOperation({ summary: 'Rezervasyonu 1 saat uzat (maks 2 kez)' })
  @ApiResponse({ status: 200, type: ReservationResponseDto })
  extend(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.reservationsService.extend(id, user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Rezervasyonu iptal et' })
  @ApiResponse({ status: 200, type: ReservationResponseDto })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: CancelReservationDto,
  ) {
    return this.reservationsService.cancel(id, user.id, dto?.reason);
  }
}
