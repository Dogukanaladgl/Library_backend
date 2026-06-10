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
import { TablesService } from './tables.service';
import { CreateTableDto, UpdateTableDto, TableResponseDto, CreateBulkTablesDto } from './dto';

@ApiTags('tables')
@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get()
  @ApiOperation({ summary: 'Tüm masaları listele' })
  @ApiQuery({ name: 'hallId', required: false, description: 'Salon ID filtresi' })
  @ApiResponse({ status: 200, description: 'Masa listesi', type: [TableResponseDto] })
  async findAll(@Query('hallId') hallId?: string) {
    return this.tablesService.findAll(hallId);
  }

  @Get('features')
  @ApiOperation({ summary: 'Tüm masa özelliklerini listele' })
  async getAllFeatures() {
    return this.tablesService.getAllFeatures();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Masa detayını getir' })
  @ApiResponse({ status: 200, description: 'Masa detayı', type: TableResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tablesService.findOne(id);
  }

  @Get(':id/qr')
  @ApiOperation({ summary: 'Masa QR kodunu getir (base64 image)' })
  async getQrCode(@Param('id', ParseUUIDPipe) id: string) {
    const qrImage = await this.tablesService.getQrCodeImage(id);
    return { qrImage };
  }

  @Get('qr/:qrCode')
  @ApiOperation({ summary: 'QR kod ile masa bul' })
  async findByQrCode(@Param('qrCode') qrCode: string) {
    return this.tablesService.findByQrCode(qrCode);
  }

  @Post()
  @ApiOperation({ summary: 'Yeni masa oluştur' })
  @ApiResponse({ status: 201, description: 'Masa oluşturuldu', type: TableResponseDto })
  async create(@Body() createTableDto: CreateTableDto) {
    return this.tablesService.create(createTableDto);
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Toplu masa oluştur' })
  @ApiResponse({ status: 201, description: 'Masalar oluşturuldu', type: [TableResponseDto] })
  async createBulk(@Body() createBulkDto: CreateBulkTablesDto) {
    return this.tablesService.createBulk(createBulkDto.hallId, createBulkDto.tables);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Masa güncelle' })
  @ApiResponse({ status: 200, description: 'Masa güncellendi', type: TableResponseDto })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTableDto: UpdateTableDto,
  ) {
    return this.tablesService.update(id, updateTableDto);
  }

  @Put(':id/regenerate-qr')
  @ApiOperation({ summary: 'Masa QR kodunu yenile' })
  async regenerateQr(@Param('id', ParseUUIDPipe) id: string) {
    return this.tablesService.regenerateQrCode(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Masa sil (soft delete)' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.tablesService.remove(id);
  }
}
