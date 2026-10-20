import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HallsService } from '../halls/halls.service';
import { HallAvailabilityDto, HallResponseDto } from '../halls/dto';
import { OrtakWebJwtGuard } from './guards/ortak-web-jwt.guard';
import { ORTAK_WEB_SWAGGER_TAG } from './ortak-web.constants';

@ApiTags(ORTAK_WEB_SWAGGER_TAG)
@ApiBearerAuth()
@UseGuards(OrtakWebJwtGuard)
@Controller('web/halls')
export class OrtakWebHallsController {
  constructor(private readonly hallsService: HallsService) {}

  @Get()
  @ApiOperation({ summary: 'Salon listesi (öğrenci web)' })
  @ApiResponse({ status: 200, type: [HallResponseDto] })
  findAll() {
    return this.hallsService.findAll();
  }

  @Get(':id/availability')
  @ApiOperation({ summary: 'Salon doluluk / masa kroki verisi' })
  @ApiQuery({ name: 'date', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'startTime', required: false, description: 'ISO 8601' })
  @ApiQuery({ name: 'endTime', required: false, description: 'ISO 8601' })
  @ApiResponse({ status: 200, type: HallAvailabilityDto })
  getAvailability(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('date') dateStr?: string,
    @Query('startTime') startTimeStr?: string,
    @Query('endTime') endTimeStr?: string,
  ) {
    const date = calendarDate(dateStr);
    const startTime = startTimeStr ? new Date(startTimeStr) : undefined;
    const endTime = endTimeStr ? new Date(endTimeStr) : undefined;
    return this.hallsService.getHallAvailability(id, date, startTime, endTime);
  }

  @Get(':id/slots')
  @ApiOperation({ summary: 'Salon masa slotları (1 saatlik dilimler)' })
  @ApiQuery({ name: 'date', required: false, description: 'YYYY-MM-DD' })
  getSlots(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('date') dateStr?: string,
  ) {
    return this.hallsService.getTableSlots(id, dateStr);
  }
}

function calendarDate(dateStr?: string): Date {
  const now = new Date();
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}
