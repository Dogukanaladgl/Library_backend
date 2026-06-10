import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as QRCode from 'qrcode';
import { Table, TableFeature, Hall } from '../../database/entities';
import { CreateTableDto, UpdateTableDto } from './dto';

@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(Table)
    private readonly tableRepository: Repository<Table>,
    @InjectRepository(TableFeature)
    private readonly featureRepository: Repository<TableFeature>,
    @InjectRepository(Hall)
    private readonly hallRepository: Repository<Hall>,
  ) {}

  async findAll(hallId?: string): Promise<Table[]> {
    const where: any = { isActive: true };
    if (hallId) {
      where.hallId = hallId;
    }

    return this.tableRepository.find({
      where,
      relations: ['features', 'hall'],
      order: { tableNumber: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Table> {
    const table = await this.tableRepository.findOne({
      where: { id, isActive: true },
      relations: ['features', 'hall'],
    });

    if (!table) {
      throw new NotFoundException(`Masa bulunamadı: ${id}`);
    }

    return table;
  }

  async findByQrCode(qrCode: string): Promise<Table> {
    const table = await this.tableRepository.findOne({
      where: { qrCode, isActive: true },
      relations: ['features', 'hall'],
    });

    if (!table) {
      throw new NotFoundException('Geçersiz QR kod');
    }

    return table;
  }

  async create(createTableDto: CreateTableDto): Promise<Table> {
    // Hall kontrolü
    const hall = await this.hallRepository.findOne({
      where: { id: createTableDto.hallId },
    });

    if (!hall) {
      throw new NotFoundException(`Salon bulunamadı: ${createTableDto.hallId}`);
    }

    // Benzersiz QR kod oluştur
    const qrCode = this.generateQrCode(createTableDto.hallId, createTableDto.tableNumber);

    // Feature'ları bul
    let features: TableFeature[] = [];
    if (createTableDto.featureIds?.length) {
      features = await this.featureRepository.find({
        where: { id: In(createTableDto.featureIds) },
      });
    }

    const table = this.tableRepository.create({
      ...createTableDto,
      qrCode,
      features,
    });

    const saved = await this.tableRepository.save(table);
    await this.syncHallCapacity(createTableDto.hallId);
    return saved;
  }

  async createBulk(
    hallId: string,
    tables: Array<Omit<CreateTableDto, 'hallId'>>,
  ): Promise<Table[]> {
    const hall = await this.hallRepository.findOne({
      where: { id: hallId },
    });

    if (!hall) {
      throw new NotFoundException(`Salon bulunamadı: ${hallId}`);
    }

    const createdTables: Table[] = [];

    for (const tableData of tables) {
      const qrCode = this.generateQrCode(hallId, tableData.tableNumber);

      let features: TableFeature[] = [];
      if (tableData.featureIds?.length) {
        features = await this.featureRepository.find({
          where: { id: In(tableData.featureIds) },
        });
      }

      const table = this.tableRepository.create({
        ...tableData,
        hallId,
        qrCode,
        features,
      });

      createdTables.push(await this.tableRepository.save(table));
    }

    await this.syncHallCapacity(hallId);
    return createdTables;
  }

  async update(id: string, updateTableDto: UpdateTableDto): Promise<Table> {
    const table = await this.findOne(id);

    if (updateTableDto.featureIds) {
      const features = await this.featureRepository.find({
        where: { id: In(updateTableDto.featureIds) },
      });
      table.features = features;
      delete updateTableDto.featureIds;
    }

    Object.assign(table, updateTableDto);
    return this.tableRepository.save(table);
  }

  async remove(id: string): Promise<void> {
    const table = await this.findOne(id);
    table.isActive = false;
    await this.tableRepository.save(table);
    await this.syncHallCapacity(table.hallId);
  }

  async regenerateQrCode(id: string): Promise<Table> {
    const table = await this.findOne(id);
    table.qrCode = this.generateQrCode(table.hallId, table.tableNumber);
    table.qrGeneratedAt = new Date();
    return this.tableRepository.save(table);
  }

  async getQrCodeImage(id: string): Promise<string> {
    const table = await this.findOne(id);
    const qrDataUrl = await QRCode.toDataURL(table.qrCode, {
      width: 300,
      margin: 2,
      color: {
        dark: '#1a1a2e',
        light: '#ffffff',
      },
    });
    return qrDataUrl;
  }

  // Masa özellikleri
  async getAllFeatures(): Promise<TableFeature[]> {
    return this.featureRepository.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC' },
    });
  }

  async createFeature(data: Partial<TableFeature>): Promise<TableFeature> {
    const feature = this.featureRepository.create(data);
    return this.featureRepository.save(feature);
  }

  private generateQrCode(hallId: string, tableNumber: string): string {
    const uniqueId = uuidv4().slice(0, 8);
    return `SELCUK_LIB_${hallId.slice(0, 8)}_${tableNumber}_${uniqueId}`;
  }

  /** Aktif masa sayısını salon kapasitesi alanıyla eşitler (rezervasyon motorunu etkilemez). */
  async syncHallCapacity(hallId: string): Promise<void> {
    const activeTableCount = await this.tableRepository.count({
      where: { hallId, isActive: true },
    });
    await this.hallRepository.update(hallId, { capacity: activeTableCount });
  }
}

