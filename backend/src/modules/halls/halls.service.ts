import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Hall,
  Table,
  TableLock,
  LockStatus,
  Reservation,
  ReservationStatus,
  SchedulePeriodKind,
} from '../../database/entities';
import { CreateHallDto, UpdateHallDto } from './dto';
import { SchedulesService } from '../schedules/schedules.service';
import { HallAvailabilityService } from '../hall-availability/hall-availability.service';

/** Postgres date / TypeORM eşlemesinde güvenli gün anahtarı (YYYY-MM-DD) */
function ymdFromJsDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function reservationEndMs(r: Reservation): number {
  const t = r.endTime as unknown;
  return t instanceof Date ? t.getTime() : new Date(String(t)).getTime();
}

function reservationStartMs(r: Reservation): number {
  const t = r.startTime as unknown;
  return t instanceof Date ? t.getTime() : new Date(String(t)).getTime();
}

// ReservationsService ile uyumlu: slot başlangıcından sonraki ilk 30 dk içinde rezervasyon alınabilir.
const LATE_RESERVATION_GRACE_MINUTES = 30;

@Injectable()
export class HallsService {
  constructor(
    @InjectRepository(Hall)
    private readonly hallRepository: Repository<Hall>,
    @InjectRepository(Table)
    private readonly tableRepository: Repository<Table>,
    @InjectRepository(TableLock)
    private readonly tableLockRepository: Repository<TableLock>,
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    private readonly schedulesService: SchedulesService,
    private readonly hallAvailabilityService: HallAvailabilityService,
  ) {}

  async findAll(): Promise<Hall[]> {
    return this.hallRepository.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC', name: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Hall> {
    const hall = await this.hallRepository.findOne({
      where: { id, isActive: true },
    });

    if (!hall) {
      throw new NotFoundException(`Salon bulunamadı: ${id}`);
    }

    return hall;
  }

  async findWithTables(id: string): Promise<Hall> {
    const hall = await this.hallRepository.findOne({
      where: { id, isActive: true },
      relations: ['tables', 'tables.features'],
    });

    if (!hall) {
      throw new NotFoundException(`Salon bulunamadı: ${id}`);
    }

    // Sadece aktif masaları filtrele
    hall.tables = hall.tables.filter((table) => table.isActive);

    return hall;
  }

  /**
   * reservation_date (date) ile TypeORM find() bazen eşleşmez; to_char ile gün bazında kesin sorgu.
   */
  private async reservationsForHallCalendarDay(hallId: string, ymd: string): Promise<Reservation[]> {
    return this.reservationRepository
      .createQueryBuilder('r')
      .where('r.hallId = :hallId', { hallId })
      .andWhere("to_char(r.reservationDate, 'YYYY-MM-DD') = :ymd", { ymd })
      .andWhere('r.status IN (:...st)', {
        st: [ReservationStatus.RESERVED, ReservationStatus.CHECKED_IN],
      })
      .getMany();
  }

  private async locksForHallCalendarDay(hallId: string, ymd: string): Promise<TableLock[]> {
    return this.tableLockRepository
      .createQueryBuilder('lock')
      .innerJoin('lock.table', 'table')
      .where('table.hallId = :hallId', { hallId })
      .andWhere("to_char(lock.lockDate, 'YYYY-MM-DD') = :ymd", { ymd })
      .andWhere('lock.status = :ls', { ls: LockStatus.ACTIVE })
      .getMany();
  }

  async getHallAvailability(
    hallId: string,
    date: Date,
    startTime?: Date,
    endTime?: Date,
  ): Promise<{
    hall: Hall;
    tables: Array<{
      table: Table;
      isAvailable: boolean;
      currentLock?: TableLock;
      availableFrom?: Date;
    }>;
    statistics: {
      total: number;
      available: number;
      occupied: number;
      occupancyRate: number;
    };
  }> {
    const hall = await this.findWithTables(hallId);
    const now = new Date();
    const ymd = ymdFromJsDate(date);

    const [dayReservations, dayLocks] = await Promise.all([
      this.reservationsForHallCalendarDay(hallId, ymd),
      this.locksForHallCalendarDay(hallId, ymd),
    ]);

    const busyByTableId = new Map<string, Reservation>();
    const lockedByTableId = new Map<string, TableLock>();
    const startMs = startTime?.getTime();
    const endMs = endTime?.getTime();

    if (startTime && endTime && startMs !== undefined && endMs !== undefined) {
      for (const r of dayReservations) {
        if (
          reservationStartMs(r) < endMs &&
          reservationEndMs(r) > startMs
        ) {
          busyByTableId.set(r.tableId, r);
        }
      }
      for (const l of dayLocks) {
        const ls = l.lockStart instanceof Date ? l.lockStart.getTime() : new Date(String(l.lockStart)).getTime();
        const le = l.lockEnd instanceof Date ? l.lockEnd.getTime() : new Date(String(l.lockEnd)).getTime();
        if (ls < endMs && le > startMs) {
          lockedByTableId.set(l.tableId, l);
        }
      }
    } else {
      const nowMs = now.getTime();
      for (const r of dayReservations) {
        if (reservationEndMs(r) > nowMs) {
          busyByTableId.set(r.tableId, r);
        }
      }
      for (const l of dayLocks) {
        const le = l.lockEnd instanceof Date ? l.lockEnd.getTime() : new Date(String(l.lockEnd)).getTime();
        if (le > nowMs) {
          lockedByTableId.set(l.tableId, l);
        }
      }
    }

    const tablesWithAvailability = hall.tables.map((table) => {
      const r = busyByTableId.get(table.id);
      const lock = lockedByTableId.get(table.id);
      const isAvailable = !r && !lock;

      let availableFrom: Date | undefined;
      if (lock) {
        availableFrom = lock.lockEnd instanceof Date ? lock.lockEnd : new Date(String(lock.lockEnd));
      } else if (r) {
        availableFrom = r.endTime as Date;
      }

      return {
        table,
        isAvailable,
        currentLock: lock,
        availableFrom,
      };
    });

    const available = tablesWithAvailability.filter((t) => t.isAvailable).length;
    const total = hall.tables.length;

    return {
      hall,
      tables: tablesWithAvailability,
      statistics: {
        total,
        available,
        occupied: total - available,
        occupancyRate: total > 0 ? ((total - available) / total) * 100 : 0,
      },
    };
  }

  /**
   * Generate per-table 1-hour slots for the given date.
   * Conflict checks use the same overlap logic as ReservationsService.create().
   */
  async getTableSlots(
    hallId: string,
    dateStr?: string,
  ): Promise<{
    hallId: string;
    hallName: string;
    date: string;
    operatingHours: { opening: string; closing: string; is24h: boolean };
    datePolicy: {
      periodKind: SchedulePeriodKind;
      allowAdvanceBooking: boolean;
      maxAdvanceDays: number;
      scheduleName: string;
    };
    hallStatus?: {
      isClosed: boolean;
      reason?: string | null;
      note?: string | null;
    };
    tables: Array<{
      tableId: string;
      tableNumber: string;
      features: Array<{ id: string; name: string; icon: string }>;
      slots: Array<{
        startTime: string;
        endTime: string;
        isAvailable: boolean;
        blockedUntil?: string;
      }>;
    }>;
  }> {
    const hall = await this.findWithTables(hallId);
    const now = new Date();

    let year: number, month: number, day: number;
    if (dateStr) {
      [year, month, day] = dateStr.split('-').map(Number);
    } else {
      year = now.getFullYear();
      month = now.getMonth() + 1;
      day = now.getDate();
    }
    const queryDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    const ymd = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const hours = await this.schedulesService.getOperatingHoursForDate(queryDate);
    const reservationPolicy = await this.schedulesService.getReservationDatePolicyForDate(queryDate);
    const allowAdvanceBooking =
      reservationPolicy.periodKind === SchedulePeriodKind.SPECIAL &&
      (reservationPolicy.rules?.allowAdvanceBooking ?? true);
    const maxAdvanceDays = Math.max(
      1,
      Number(reservationPolicy.rules?.maxAdvanceDays ?? 1),
    );
    const openH = hours.is24h ? 0 : Number(hours.openingTime.split(':')[0]);
    const closeH = hours.is24h ? 24 : Number(hours.closingTime.split(':')[0]);

    const [activeReservations, activeLocks, closureStatus, dayExceptions] =
      await Promise.all([
        this.reservationsForHallCalendarDay(hallId, ymd),
        this.locksForHallCalendarDay(hallId, ymd),
        this.hallAvailabilityService.getClosureStatusForHallDate(hallId, ymd),
        this.hallAvailabilityService.getExceptionsForHallDate(hallId, ymd),
      ]);

    const tables = hall.tables.map((table) => {
      const tableReservations = activeReservations.filter((r) => r.tableId === table.id);
      const tableLocks = activeLocks.filter((l) => l.tableId === table.id);

      const slots: Array<{
        startTime: string;
        endTime: string;
        isAvailable: boolean;
        blockedUntil?: string;
      }> = [];

      for (let h = openH; h < closeH; h++) {
        const slotStart = new Date(year, month - 1, day, h, 0, 0, 0);
        const slotEnd = new Date(year, month - 1, day, h + 1, 0, 0, 0);

        const slotGraceDeadline = new Date(
          slotStart.getTime() + LATE_RESERVATION_GRACE_MINUTES * 60 * 1000,
        );
        const isPastSlotWindowClosed = now > slotGraceDeadline;
        const shouldHidePastSlot = !hours.is24h && slotEnd <= now;

        // Normal akışta mevcut davranışı koru (tam geçmiş saatleri gizle).
        // 7/24 özel dönemde tüm saat aralıklarını göster; geçmişi sadece pasif işaretle.
        if (shouldHidePastSlot) continue;

        // Same overlap logic as ReservationsService.create()
        const conflictingReservation = tableReservations.find(
          (r) => r.startTime < slotEnd && r.endTime > slotStart,
        );
        const conflictingLock = tableLocks.find(
          (l) => l.lockStart < slotEnd && l.lockEnd > slotStart,
        );

        const blockedByHallRules =
          closureStatus.isClosed ||
          this.hallAvailabilityService.isSlotBlockedByExceptions(
            slotStart,
            slotEnd,
            dayExceptions,
          );

        const isAvailable =
          !blockedByHallRules &&
          !conflictingReservation &&
          !conflictingLock &&
          !isPastSlotWindowClosed;

        const slot: {
          startTime: string;
          endTime: string;
          isAvailable: boolean;
          blockedUntil?: string;
        } = {
          startTime: slotStart.toISOString(),
          endTime: slotEnd.toISOString(),
          isAvailable,
        };

        if (!isAvailable) {
          const blockEnd = conflictingLock?.lockEnd ?? conflictingReservation?.endTime;
          if (blockEnd) {
            slot.blockedUntil =
              blockEnd instanceof Date ? blockEnd.toISOString() : String(blockEnd);
          }
        }

        slots.push(slot);
      }

      return {
        tableId: table.id,
        tableNumber: table.tableNumber,
        features: (table.features || []).map((f) => ({
          id: f.id,
          name: f.name,
          icon: f.icon,
        })),
        slots,
      };
    });

    const usedDateStr =
      dateStr ||
      `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    return {
      hallId,
      hallName: hall.name,
      date: usedDateStr,
      operatingHours: {
        opening: hours.openingTime,
        closing: hours.closingTime,
        is24h: hours.is24h,
      },
      datePolicy: {
        periodKind: reservationPolicy.periodKind,
        allowAdvanceBooking,
        maxAdvanceDays,
        scheduleName: reservationPolicy.scheduleName,
      },
      hallStatus: closureStatus.isClosed
        ? {
            isClosed: true,
            reason: closureStatus.reason ?? null,
            note: closureStatus.note ?? null,
          }
        : { isClosed: false },
      tables,
    };
  }

  async create(createHallDto: CreateHallDto): Promise<Hall> {
    const hall = this.hallRepository.create(createHallDto);
    return this.hallRepository.save(hall);
  }

  async update(id: string, updateHallDto: UpdateHallDto): Promise<Hall> {
    const hall = await this.findOne(id);
    Object.assign(hall, updateHallDto);
    return this.hallRepository.save(hall);
  }

  async remove(id: string): Promise<void> {
    const hall = await this.findOne(id);
    hall.isActive = false;
    await this.hallRepository.save(hall);
  }
}
