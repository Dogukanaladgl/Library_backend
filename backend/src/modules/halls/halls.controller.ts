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

import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

import { HallsService } from './halls.service';

import { HallAvailabilityService } from '../hall-availability/hall-availability.service';

import { CreateHallDto, UpdateHallDto, HallResponseDto, HallAvailabilityDto } from './dto';



@ApiTags('halls')

@Controller('halls')

export class HallsController {

  constructor(

    private readonly hallsService: HallsService,

    private readonly hallAvailabilityService: HallAvailabilityService,

  ) {}



  @Get()

  @ApiOperation({ summary: 'Tüm salonları listele' })

  @ApiResponse({ status: 200, description: 'Salon listesi', type: [HallResponseDto] })

  async findAll() {

    return this.hallsService.findAll();

  }



  @Get(':id')

  @ApiOperation({ summary: 'Salon detayını getir' })

  @ApiResponse({ status: 200, description: 'Salon detayı', type: HallResponseDto })

  @ApiResponse({ status: 404, description: 'Salon bulunamadı' })

  async findOne(@Param('id', ParseUUIDPipe) id: string) {

    return this.hallsService.findOne(id);

  }



  @Get(':id/tables')

  @ApiOperation({ summary: 'Salon masalarını getir' })

  @ApiResponse({ status: 200, description: 'Salon ve masaları' })

  async findWithTables(@Param('id', ParseUUIDPipe) id: string) {

    return this.hallsService.findWithTables(id);

  }



  @Get(':id/availability')

  @ApiOperation({ summary: 'Salon doluluk durumunu getir' })

  @ApiQuery({ name: 'date', required: false, description: 'Tarih (YYYY-MM-DD)' })

  @ApiQuery({ name: 'startTime', required: false, description: 'Başlangıç zamanı (ISO 8601)' })

  @ApiQuery({ name: 'endTime', required: false, description: 'Bitiş zamanı (ISO 8601)' })

  @ApiResponse({ status: 200, description: 'Doluluk durumu', type: HallAvailabilityDto })

  async getAvailability(

    @Param('id', ParseUUIDPipe) id: string,

    @Query('date') dateStr?: string,

    @Query('startTime') startTimeStr?: string,

    @Query('endTime') endTimeStr?: string,

  ) {

    const now = new Date();

    const date =

      dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)

        ? (() => {

            const [y, m, d] = dateStr.split('-').map(Number);

            return new Date(y, m - 1, d, 0, 0, 0, 0);

          })()

        : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

    const startTime = startTimeStr ? new Date(startTimeStr) : undefined;

    const endTime = endTimeStr ? new Date(endTimeStr) : undefined;

    return this.hallsService.getHallAvailability(id, date, startTime, endTime);

  }



  @Get(':id/availability-exceptions')

  @ApiOperation({ summary: 'Salon saatlik acik/kapali ayarlari (ogrenci okuma)' })

  @ApiQuery({ name: 'date', required: true, description: 'YYYY-MM-DD' })

  async getAvailabilityExceptions(

    @Param('id', ParseUUIDPipe) id: string,

    @Query('date') date: string,

  ) {

    const rows = await this.hallAvailabilityService.getExceptionsForHallDate(

      id,

      date,

    );

    return rows.map((r) =>

      this.hallAvailabilityService.formatExceptionResponse(r),

    );

  }



  @Get(':id/closures')

  @ApiOperation({ summary: 'Salon kapatma kayitlari (ogrenci okuma)' })

  @ApiQuery({ name: 'startDate', required: false })

  @ApiQuery({ name: 'endDate', required: false })

  async getClosures(

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



  @Get(':id/slots')

  @ApiOperation({

    summary: 'Salon masa slotlarını getir (1 saatlik dilimler)',

    description:

      'Her masa için gün içindeki 1 saatlik zaman dilimlerini ve müsaitlik durumunu döner. ' +

      'Çakışma kontrolü reservation motoru ile aynı mantığı kullanır.',

  })

  @ApiQuery({ name: 'date', required: false, description: 'Tarih (YYYY-MM-DD), varsayılan: bugün' })

  @ApiResponse({ status: 200, description: 'Masa slotları' })

  async getSlots(

    @Param('id', ParseUUIDPipe) id: string,

    @Query('date') dateStr?: string,

  ) {

    return this.hallsService.getTableSlots(id, dateStr);

  }



  @Post()

  @ApiOperation({ summary: 'Yeni salon oluştur' })

  @ApiResponse({ status: 201, description: 'Salon oluşturuldu', type: HallResponseDto })

  async create(@Body() createHallDto: CreateHallDto) {

    return this.hallsService.create(createHallDto);

  }



  @Put(':id')

  @ApiOperation({ summary: 'Salon güncelle' })

  @ApiResponse({ status: 200, description: 'Salon güncellendi', type: HallResponseDto })

  async update(

    @Param('id', ParseUUIDPipe) id: string,

    @Body() updateHallDto: UpdateHallDto,

  ) {

    return this.hallsService.update(id, updateHallDto);

  }



  @Delete(':id')

  @ApiOperation({ summary: 'Salon sil (soft delete)' })

  @ApiResponse({ status: 200, description: 'Salon silindi' })

  async remove(@Param('id', ParseUUIDPipe) id: string) {

    return this.hallsService.remove(id);

  }

}


