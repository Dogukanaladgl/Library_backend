import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import { getNowInTurkeyFrame } from '../../common/utils/turkey-time';
import { Hall, Table, TableLock, LockStatus, Reservation } from '../../database/entities';
import { ReservationStatus } from '../../database/entities/reservation.entity';

export interface HallOccupancy {
  hallId: string;
  hallName: string;
  floor: number;
  totalTables: number;
  occupiedTables: number;
  availableTables: number;
  occupancyRate: number;
  soonAvailable: number; // 30 dk içinde boşalacak
}

export interface OverallStatistics {
  totalHalls: number;
  totalTables: number;
  occupiedTables: number;
  availableTables: number;
  overallOccupancyRate: number;
  activeReservations: number;
  hallsOccupancy: HallOccupancy[];
  peakHours: Array<{ hour: number; occupancy: number }>;
}

@Injectable()
export class StatisticsService {
  constructor(
    @InjectRepository(Hall)
    private readonly hallRepository: Repository<Hall>,
    @InjectRepository(Table)
    private readonly tableRepository: Repository<Table>,
    @InjectRepository(TableLock)
    private readonly tableLockRepository: Repository<TableLock>,
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
  ) {}

  async getOverallOccupancy(): Promise<OverallStatistics> {
    const now = getNowInTurkeyFrame();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    // Aktif salonları al
    const halls = await this.hallRepository.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC' },
    });

    // Tüm aktif masaları al
    const allTables = await this.tableRepository.find({
      where: { isActive: true },
    });

    // Aktif kilitleri al
    const activeLocks = await this.tableLockRepository
      .createQueryBuilder('lock')
      .where('lock.status = :status', { status: LockStatus.ACTIVE })
      .andWhere('lock.lock_start <= :now', { now })
      .andWhere('lock.lock_end > :now', { now })
      .getMany();

    const lockedTableIds = new Set(activeLocks.map((l) => l.tableId));

    // 30 dk içinde boşalacaklar
    const soonAvailableTime = new Date(now.getTime() + 30 * 60 * 1000);
    const soonAvailableLocks = activeLocks.filter(
      (l) => l.lockEnd <= soonAvailableTime,
    );
    const soonAvailableTableIds = new Set(soonAvailableLocks.map((l) => l.tableId));

    // Salon bazlı istatistikler
    const hallsOccupancy: HallOccupancy[] = halls.map((hall) => {
      const hallTables = allTables.filter((t) => t.hallId === hall.id);
      const occupiedCount = hallTables.filter((t) => lockedTableIds.has(t.id)).length;
      const soonAvailableCount = hallTables.filter((t) => soonAvailableTableIds.has(t.id)).length;

      return {
        hallId: hall.id,
        hallName: hall.name,
        floor: hall.floor,
        totalTables: hallTables.length,
        occupiedTables: occupiedCount,
        availableTables: hallTables.length - occupiedCount,
        occupancyRate: hallTables.length > 0 ? (occupiedCount / hallTables.length) * 100 : 0,
        soonAvailable: soonAvailableCount,
      };
    });

    const totalTables = allTables.length;
    const occupiedTables = lockedTableIds.size;

    // Sistemde aktif sayılan rezervasyonlar: henüz bitmemiş RESERVED veya CHECKED_IN
    // (İleri saatli rezervasyonlar da dahil; rezervasyonlar zaten sadece "bugün" için oluşturulabiliyor.)
    const activeReservations = await this.reservationRepository.count({
      where: {
        status: In([ReservationStatus.RESERVED, ReservationStatus.CHECKED_IN]),
        endTime: MoreThan(now),
      },
    });

    return {
      totalHalls: halls.length,
      totalTables,
      occupiedTables,
      availableTables: totalTables - occupiedTables,
      overallOccupancyRate: totalTables > 0 ? (occupiedTables / totalTables) * 100 : 0,
      activeReservations,
      hallsOccupancy,
      peakHours: await this.getPeakHours(),
    };
  }

  async getHallOccupancy(hallId: string): Promise<HallOccupancy> {
    const now = getNowInTurkeyFrame();

    const hall = await this.hallRepository.findOne({
      where: { id: hallId, isActive: true },
    });

    if (!hall) {
      throw new Error('Salon bulunamadı');
    }

    const tables = await this.tableRepository.find({
      where: { hallId, isActive: true },
    });

    const activeLocks = await this.tableLockRepository
      .createQueryBuilder('lock')
      .innerJoin('lock.table', 'table')
      .where('table.hall_id = :hallId', { hallId })
      .andWhere('lock.status = :status', { status: LockStatus.ACTIVE })
      .andWhere('lock.lock_start <= :now', { now })
      .andWhere('lock.lock_end > :now', { now })
      .getMany();

    const lockedTableIds = new Set(activeLocks.map((l) => l.tableId));

    const soonAvailableTime = new Date(now.getTime() + 30 * 60 * 1000);
    const soonAvailableCount = activeLocks.filter(
      (l) => l.lockEnd <= soonAvailableTime,
    ).length;

    const occupiedCount = lockedTableIds.size;

    return {
      hallId: hall.id,
      hallName: hall.name,
      floor: hall.floor,
      totalTables: tables.length,
      occupiedTables: occupiedCount,
      availableTables: tables.length - occupiedCount,
      occupancyRate: tables.length > 0 ? (occupiedCount / tables.length) * 100 : 0,
      soonAvailable: soonAvailableCount,
    };
  }

  private async getPeakHours(): Promise<Array<{ hour: number; occupancy: number }>> {
    // Son 7 günün verilerine göre peak saatleri hesapla
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const reservations = await this.reservationRepository
      .createQueryBuilder('r')
      .select('EXTRACT(HOUR FROM r.start_time)', 'hour')
      .addSelect('COUNT(*)', 'count')
      .where('r.created_at >= :sevenDaysAgo', { sevenDaysAgo })
      .groupBy('EXTRACT(HOUR FROM r.start_time)')
      .orderBy('hour', 'ASC')
      .getRawMany();

    const maxCount = Math.max(...reservations.map((r) => parseInt(r.count) || 0), 1);

    return reservations.map((r) => ({
      hour: parseInt(r.hour),
      occupancy: (parseInt(r.count) / maxCount) * 100,
    }));
  }
}

