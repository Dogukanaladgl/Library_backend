import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Hall,
  HallAvailabilityException,
  AvailabilityExceptionType,
  HallClosure,
  HallClosureReason,
} from '../../database/entities';
import {
  CreateAvailabilityExceptionDto,
  CreateHallClosureDto,
} from './dto/manage-availability.dto';

function ymdFromJsDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function tomorrowYmd(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return ymdFromJsDate(d);
}

function parseYmd(ymd: string): Date {
  const [y, m, day] = ymd.split('-').map(Number);
  return new Date(y, m - 1, day, 0, 0, 0, 0);
}

function timeToMinutes(time: string): number {
  const parts = time.split(':').map(Number);
  return parts[0] * 60 + (parts[1] ?? 0);
}

function normalizeTime(time: string): string {
  const [h, m] = time.split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}:00`;
}

export interface HallClosureStatus {
  isClosed: boolean;
  reason?: HallClosureReason | null;
  note?: string | null;
}

@Injectable()
export class HallAvailabilityService {
  constructor(
    @InjectRepository(HallAvailabilityException)
    private readonly exceptionRepository: Repository<HallAvailabilityException>,
    @InjectRepository(HallClosure)
    private readonly closureRepository: Repository<HallClosure>,
    @InjectRepository(Hall)
    private readonly hallRepository: Repository<Hall>,
  ) {}

  // ── Validasyon ─────────────────────────────────────────────

  assertAdminDateAtLeastTomorrow(dateYmd: string, label = 'Tarih'): void {
    if (dateYmd < tomorrowYmd()) {
      throw new BadRequestException(
        `${label} en az 1 gun onceden (yarin veya sonrasi) secilmelidir.`,
      );
    }
  }

  private assertTimeRange(startTime: string, endTime: string): void {
    if (timeToMinutes(startTime) >= timeToMinutes(endTime)) {
      throw new BadRequestException('Bitis saati baslangictan sonra olmalidir.');
    }
  }

  private async assertHallExists(hallId: string): Promise<Hall> {
    const hall = await this.hallRepository.findOne({
      where: { id: hallId, isActive: true },
    });
    if (!hall) {
      throw new NotFoundException(`Salon bulunamadi: ${hallId}`);
    }
    return hall;
  }

  // ── Okuma (public + dahili) ────────────────────────────────

  async getExceptionsForHallDate(
    hallId: string,
    dateYmd: string,
  ): Promise<HallAvailabilityException[]> {
    return this.exceptionRepository
      .createQueryBuilder('e')
      .where('e.hall_id = :hallId', { hallId })
      .andWhere('e.is_active = true')
      .andWhere("to_char(e.exception_date, 'YYYY-MM-DD') = :dateYmd", {
        dateYmd,
      })
      .orderBy('e.start_time', 'ASC')
      .getMany();
  }

  async getClosuresForHallInRange(
    hallId: string,
    startDateYmd: string,
    endDateYmd: string,
  ): Promise<HallClosure[]> {
    return this.closureRepository
      .createQueryBuilder('c')
      .where('c.is_active = true')
      .andWhere('(c.hall_id = :hallId OR c.hall_id IS NULL)', { hallId })
      .andWhere('c.start_date <= :endDateYmd', { endDateYmd })
      .andWhere('c.end_date >= :startDateYmd', { startDateYmd })
      .orderBy('c.start_date', 'ASC')
      .getMany();
  }

  async getClosureStatusForHallDate(
    hallId: string,
    dateYmd: string,
  ): Promise<HallClosureStatus> {
    const closure = await this.closureRepository
      .createQueryBuilder('c')
      .where('c.is_active = true')
      .andWhere('(c.hall_id = :hallId OR c.hall_id IS NULL)', { hallId })
      .andWhere('c.start_date <= :dateYmd', { dateYmd })
      .andWhere('c.end_date >= :dateYmd', { dateYmd })
      .orderBy('c.created_at', 'DESC')
      .getOne();

    if (!closure) {
      return { isClosed: false };
    }

    return {
      isClosed: true,
      reason: closure.reason,
      note: closure.note,
    };
  }

  isSlotBlockedByExceptions(
    slotStart: Date,
    slotEnd: Date,
    exceptions: HallAvailabilityException[],
  ): boolean {
    for (const ex of exceptions) {
      if (ex.exceptionType !== AvailabilityExceptionType.CLOSED) {
        continue;
      }
      const rangeStart = timeToMinutes(String(ex.startTime).slice(0, 5));
      const rangeEnd = timeToMinutes(String(ex.endTime).slice(0, 5));
      const slotStartMin = slotStart.getHours() * 60 + slotStart.getMinutes();
      const slotEndMin = slotEnd.getHours() * 60 + slotEnd.getMinutes();
      if (slotStartMin < rangeEnd && slotEndMin > rangeStart) {
        return true;
      }
    }
    return false;
  }

  /**
   * Yeni rezervasyon oncesi salon kapali mi / saatlik kapama var mi kontrolu.
   * Mevcut rezervasyonlari iptal etmez; yalnizca yeni kaydi engeller.
   */
  async validateReservationAllowed(
    hallId: string,
    startTime: Date,
    endTime: Date,
  ): Promise<void> {
    const dateYmd = ymdFromJsDate(startTime);
    const closure = await this.getClosureStatusForHallDate(hallId, dateYmd);

    if (closure.isClosed) {
      const reasonLabel = closure.reason ?? 'other';
      throw new BadRequestException(
        `Bu salon ${dateYmd} tarihinde kapalidir (${reasonLabel}).`,
      );
    }

    const exceptions = await this.getExceptionsForHallDate(hallId, dateYmd);
    if (this.isSlotBlockedByExceptions(startTime, endTime, exceptions)) {
      throw new BadRequestException(
        'Secilen saat araligi bu salon icin kapali olarak isaretlenmis.',
      );
    }
  }

  // ── Admin CRUD ─────────────────────────────────────────────

  async createAvailabilityException(
    hallId: string,
    dto: CreateAvailabilityExceptionDto,
    createdBy: string | null,
  ): Promise<HallAvailabilityException> {
    await this.assertHallExists(hallId);
    this.assertAdminDateAtLeastTomorrow(dto.date);
    this.assertTimeRange(dto.startTime, dto.endTime);

    const row = this.exceptionRepository.create({
      hallId,
      exceptionDate: parseYmd(dto.date),
      startTime: normalizeTime(dto.startTime),
      endTime: normalizeTime(dto.endTime),
      exceptionType: dto.type,
      reason: dto.reason?.trim() || null,
      createdBy,
    });

    return this.exceptionRepository.save(row);
  }

  async listAvailabilityExceptions(
    hallId: string,
    dateYmd?: string,
  ): Promise<HallAvailabilityException[]> {
    await this.assertHallExists(hallId);

    const qb = this.exceptionRepository
      .createQueryBuilder('e')
      .where('e.hall_id = :hallId', { hallId })
      .andWhere('e.is_active = true')
      .orderBy('e.exception_date', 'ASC')
      .addOrderBy('e.start_time', 'ASC');

    if (dateYmd) {
      qb.andWhere("to_char(e.exception_date, 'YYYY-MM-DD') = :dateYmd", {
        dateYmd,
      });
    }

    return qb.getMany();
  }

  async deleteAvailabilityException(
    hallId: string,
    exceptionId: string,
  ): Promise<void> {
    const row = await this.exceptionRepository.findOne({
      where: { id: exceptionId, hallId, isActive: true },
    });
    if (!row) {
      throw new NotFoundException('Saat ayari bulunamadi.');
    }
    row.isActive = false;
    await this.exceptionRepository.save(row);
  }

  async createHallClosure(
    hallId: string | null,
    dto: CreateHallClosureDto,
    createdBy: string | null,
  ): Promise<HallClosure> {
    if (hallId) {
      await this.assertHallExists(hallId);
    }

    this.assertAdminDateAtLeastTomorrow(dto.startDate, 'Baslangic tarihi');
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException(
        'Bitis tarihi baslangic tarihinden once olamaz.',
      );
    }

    const row = this.closureRepository.create({
      hallId,
      startDate: parseYmd(dto.startDate),
      endDate: parseYmd(dto.endDate),
      reason: dto.reason,
      note: dto.note?.trim() || null,
      createdBy,
    });

    return this.closureRepository.save(row);
  }

  async listHallClosures(
    hallId: string,
    startDateYmd?: string,
    endDateYmd?: string,
  ): Promise<HallClosure[]> {
    await this.assertHallExists(hallId);

    const start = startDateYmd ?? ymdFromJsDate(new Date());
    const end =
      endDateYmd ??
      (() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 3);
        return ymdFromJsDate(d);
      })();

    return this.getClosuresForHallInRange(hallId, start, end);
  }

  async deleteHallClosure(hallId: string | null, closureId: string): Promise<void> {
    const qb = this.closureRepository
      .createQueryBuilder('c')
      .where('c.id = :closureId', { closureId })
      .andWhere('c.is_active = true');

    if (hallId) {
      qb.andWhere('(c.hall_id = :hallId OR c.hall_id IS NULL)', { hallId });
    }

    const row = await qb.getOne();
    if (!row) {
      throw new NotFoundException('Kapatma kaydi bulunamadi.');
    }
    row.isActive = false;
    await this.closureRepository.save(row);
  }

  formatExceptionResponse(row: HallAvailabilityException) {
    return {
      id: row.id,
      hallId: row.hallId,
      date: ymdFromJsDate(
        row.exceptionDate instanceof Date
          ? row.exceptionDate
          : parseYmd(String(row.exceptionDate).slice(0, 10)),
      ),
      startTime: String(row.startTime).slice(0, 5),
      endTime: String(row.endTime).slice(0, 5),
      type: row.exceptionType,
      reason: row.reason,
      createdAt: row.createdAt,
    };
  }

  formatClosureResponse(row: HallClosure) {
    const toYmd = (d: Date | string) => {
      if (d instanceof Date) return ymdFromJsDate(d);
      return String(d).slice(0, 10);
    };
    return {
      id: row.id,
      hallId: row.hallId,
      startDate: toYmd(row.startDate),
      endDate: toYmd(row.endDate),
      reason: row.reason,
      note: row.note,
      createdAt: row.createdAt,
    };
  }
}
