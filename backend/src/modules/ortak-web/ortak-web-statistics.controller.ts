import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { StatisticsService } from '../statistics/statistics.service';
import { OrtakWebJwtGuard } from './guards/ortak-web-jwt.guard';
import { ORTAK_WEB_SWAGGER_TAG } from './ortak-web.constants';

@ApiTags(ORTAK_WEB_SWAGGER_TAG)
@ApiBearerAuth()
@UseGuards(OrtakWebJwtGuard)
@Controller('web/statistics')
export class OrtakWebStatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Get('occupancy')
  @ApiOperation({ summary: 'Genel salon doluluk istatistikleri' })
  getOverallOccupancy() {
    return this.statisticsService.getOverallOccupancy();
  }
}
