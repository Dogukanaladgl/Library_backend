import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto, UpdateScheduleDto } from './dto';

@ApiTags('schedules')
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  @ApiOperation({ summary: 'Tüm çalışma takvimlerini listele' })
  async findAll() {
    return this.schedulesService.findAll();
  }

  @Get('active')
  @ApiOperation({ summary: 'Aktif takvimleri listele' })
  async findActive() {
    return this.schedulesService.findActive();
  }

  @Get('current')
  @ApiOperation({ summary: 'Bugün için geçerli takvimi getir' })
  async findCurrent() {
    return this.schedulesService.findCurrent();
  }

  @Get('hours')
  @ApiOperation({ summary: 'Belirli bir tarih için çalışma saatlerini getir' })
  @ApiQuery({ name: 'date', required: false, description: 'Tarih (YYYY-MM-DD)' })
  async getOperatingHours(@Query('date') dateStr?: string) {
    const date = dateStr ? new Date(dateStr) : new Date();
    return this.schedulesService.getOperatingHoursForDate(date);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Takvim detayını getir' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.schedulesService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Yeni çalışma takvimi oluştur' })
  async create(@Body() createDto: CreateScheduleDto) {
    return this.schedulesService.create(createDto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Takvim güncelle' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateScheduleDto,
  ) {
    return this.schedulesService.update(id, updateDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Takvim sil (soft delete)' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.schedulesService.remove(id);
  }
}
