import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, LessThanOrEqual, MoreThanOrEqual, Not } from 'typeorm';
import {
  Reservation,
  ReservationStatus,
  Hall,
  Table,
  TableFeature,
  TableLock,
  LockStatus,
  OperatingSchedule,
  ScheduleType,
  SchedulePeriodKind,
  User,
} from '../../database/entities';
import {
  CreateSpecialPeriodDto,
  ToggleSpecialPeriodDto,
  UpdateSpecialPeriodDto,
} from './dto/manage-special-period.dto';
import { SumobAuthService } from '../sumob-auth/sumob-auth.service';

/**
 * Library admin servisleri yalnızca rezervasyon/salon/masa/özel dönem
 * yönetimini kapsar. Kullanıcı bilgileri, oturumları ve rol atamaları
 * SUMOB mobil DB tarafında yönetildiği için burada yer almaz.
 */
@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    @InjectRepository(Hall)
    private readonly hallRepository: Repository<Hall>,
    @InjectRepository(Table)
    private readonly tableRepository: Repository<Table>,
    @InjectRepository(TableFeature)
    private readonly featureRepository: Repository<TableFeature>,
    @InjectRepository(TableLock)
    private readonly tableLockRepository: Repository<TableLock>,
    @InjectRepository(OperatingSchedule)
    private readonly scheduleRepository: Repository<OperatingSchedule>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly sumobAuth: SumobAuthService,
  ) {}

  // ── Staff Members (yarı zamanlı salon görevlileri) ────────
  // Library DB'de role STUDENT kalır; `isStaffMember=true` ile staff paneli
  // erişimi açılır. SUMOB tarafı bağımsız: bu sadece library yetki kaydı.

  async listStaffMembers(): Promise<
    Array<{ studentNumber: string; createdAt: Date }>
  > {
    const rows = await this.userRepository.find({
      where: { isStaffMember: true },
      select: ['studentNumber', 'createdAt'],
      order: { createdAt: 'DESC' },
    });
    return rows.map((u) => ({
      studentNumber: u.studentNumber,
      createdAt: u.createdAt,
    }));
  }

  async addStaffMember(
    studentNumber: string,
  ): Promise<{ studentNumber: string }> {
    const trimmed = (studentNumber ?? '').trim();
    if (!trimmed) {
      throw new BadRequestException('Kurum numarası boş olamaz.');
    }
    // Library row yoksa lazy yarat (rezervasyon dışı tek provisioning yolu).
    await this.sumobAuth.ensureLibraryUserId(trimmed);
    const row = await this.userRepository.findOne({
      where: { studentNumber: trimmed },
    });
    if (!row) {
      throw new NotFoundException('Kullanıcı satırı oluşturulamadı.');
    }
    if (!row.isStaffMember) {
      row.isStaffMember = true;
      await this.userRepository.save(row);
    }
    this.sumobAuth.invalidateByUserId(row.id);
    return { studentNumber: row.studentNumber };
  }

  async removeStaffMember(studentNumber: string): Promise<void> {
    const trimmed = (studentNumber ?? '').trim();
    if (!trimmed) {
      throw new BadRequestException('Kurum numarası boş olamaz.');
    }
    const row = await this.userRepository.findOne({
      where: { studentNumber: trimmed },
    });
    if (!row || !row.isStaffMember) {
      // Idempotent: yoksa veya zaten staff değilse 404 vermeye gerek yok.
      return;
    }
    row.isStaffMember = false;
    await this.userRepository.save(row);
    this.sumobAuth.invalidateByUserId(row.id);
  }

  // ── Reservations ───────────────────────────────────────────

  async getReservations(query?: {
    status?: string;
    studentQuery?: string;
    searchStudentNumber?: string;
    nameQuery?: string;
    searchFullName?: string;
    dateYmd?: string;
    date?: string;
    page?: string;
    limit?: string;
  }): Promise<{
    items: Reservation[];
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  }> {
    const statusFilter = query?.status?.trim().toLowerCase();
    const studentNumberQuery = (
      query?.studentQuery ??
      query?.searchStudentNumber ??
      ''
    ).trim();
    const fullNameQuery = (
      query?.nameQuery ??
      query?.searchFullName ??
      ''
    ).trim();
    const dateFilter = (query?.dateYmd ?? query?.date ?? '').trim();
    const page = Math.max(1, Number.parseInt(query?.page ?? '1', 10) || 1);
    const limit = Math.min(
      100,
      Math.max(1, Number.parseInt(query?.limit ?? '20', 10) || 20),
    );

    const qb = this.reservationRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.table', 'table')
      .leftJoinAndSelect('r.hall', 'hall')
      .leftJoinAndSelect('r.user', 'user');

    if (statusFilter) {
      const mapped: Record<string, ReservationStatus[]> = {
        active: [ReservationStatus.RESERVED, ReservationStatus.CHECKED_IN],
        cancelled: [ReservationStatus.CANCELLED],
        completed: [ReservationStatus.COMPLETED],
        no_show: [ReservationStatus.NO_SHOW, ReservationStatus.EXPIRED],
        expired: [ReservationStatus.NO_SHOW, ReservationStatus.EXPIRED],
      };
      const statuses =
        mapped[statusFilter] ||
        (Object.values(ReservationStatus).includes(
          statusFilter as ReservationStatus,
        )
          ? [statusFilter as ReservationStatus]
          : undefined);
      if (statuses) {
        qb.andWhere('r.status IN (:...statuses)', { statuses });
      }
    }

    if (studentNumberQuery) {
      qb.andWhere('user.student_number ILIKE :studentNumberQuery', {
        studentNumberQuery: `%${studentNumberQuery}%`,
      });
    }

    // Ad soyad araması SUMOB tarafındadır; library DB profil verisi tutmuyor.
    // fullNameQuery parametresi geriye dönük uyumluluk için kabul edilir, no-op.
    void fullNameQuery;

    if (dateFilter) {
      qb.andWhere("to_char(r.reservation_date, 'YYYY-MM-DD') = :dateFilter", {
        dateFilter,
      });
    }

    qb.orderBy('r.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();
    return {
      items,
      page,
      limit,
      total,
      hasMore: page * limit < total,
    };
  }

  async adminCancelReservation(reservationId: string): Promise<Reservation> {
    const reservation = await this.reservationRepository.findOne({
      where: { id: reservationId },
      relations: ['table', 'hall'],
    });
    if (!reservation) throw new NotFoundException('Rezervasyon bulunamadı.');

    const isActive =
      reservation.status === ReservationStatus.RESERVED ||
      reservation.status === ReservationStatus.CHECKED_IN;

    if (!isActive) {
      throw new BadRequestException('Bu rezervasyon iptal edilemez.');
    }

    const now = new Date();
    reservation.status = ReservationStatus.CANCELLED;
    reservation.cancelledAt = now;
    reservation.cancelledReason = 'Yönetici tarafından iptal edildi';
    await this.reservationRepository.save(reservation);

    await this.tableLockRepository.update(
      { reservationId, status: LockStatus.ACTIVE },
      { status: LockStatus.RELEASED, releasedAt: now },
    );

    return reservation;
  }

  // ── Halls / Tables ─────────────────────────────────────────

  async getHalls(): Promise<
    Array<
      Hall & {
        totalTables: number;
        occupiedTables: number;
        availableTables: number;
        occupancyRate: number;
      }
    >
  > {
    const halls = await this.hallRepository.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC', name: 'ASC' },
    });

    if (halls.length === 0) {
      return [];
    }

    const hallIds = halls.map((h) => h.id);
    const tables = await this.tableRepository.find({
      where: { hallId: In(hallIds), isActive: true },
      select: ['id', 'hallId'],
    });

    const totalByHall = new Map<string, number>();
    for (const t of tables) {
      totalByHall.set(t.hallId, (totalByHall.get(t.hallId) ?? 0) + 1);
    }

    const now = new Date();
    const occupiedRaw = await this.tableLockRepository
      .createQueryBuilder('l')
      .innerJoin('tables', 't', 't.id = l.table_id')
      .select('t.hall_id', 'hallId')
      .addSelect('COUNT(DISTINCT l.table_id)', 'occupiedCount')
      .where('l.status = :status', { status: LockStatus.ACTIVE })
      .andWhere('l.lock_start <= :now', { now })
      .andWhere('l.lock_end > :now', { now })
      .andWhere('t.is_active = true')
      .andWhere('t.hall_id IN (:...hallIds)', { hallIds })
      .groupBy('t.hall_id')
      .getRawMany<{ hallId: string; occupiedCount: string }>();

    const occupiedByHall = new Map<string, number>();
    for (const row of occupiedRaw) {
      occupiedByHall.set(row.hallId, Number(row.occupiedCount) || 0);
    }

    return halls.map((hall) => {
      const totalTables = totalByHall.get(hall.id) ?? 0;
      const occupiedTables = occupiedByHall.get(hall.id) ?? 0;
      const availableTables = Math.max(0, totalTables - occupiedTables);
      const occupancyRate =
        totalTables > 0 ? (occupiedTables / totalTables) * 100 : 0;
      return {
        ...hall,
        totalTables,
        occupiedTables,
        availableTables,
        occupancyRate,
      };
    });
  }

  async getHallTables(hallId: string): Promise<Table[]> {
    return this.tableRepository.find({
      where: { hallId, isActive: true },
      relations: ['features'],
      order: { tableNumber: 'ASC' },
    });
  }

  async updateTable(
    tableId: string,
    dto: {
      positionX?: number;
      positionY?: number;
      width?: number;
      height?: number;
      featureIds?: string[];
    },
  ): Promise<Table> {
    const table = await this.tableRepository.findOne({
      where: { id: tableId },
      relations: ['features'],
    });
    if (!table) throw new NotFoundException('Masa bulunamadı.');

    if (dto.positionX !== undefined) table.positionX = dto.positionX;
    if (dto.positionY !== undefined) table.positionY = dto.positionY;
    if (dto.width !== undefined) table.width = dto.width;
    if (dto.height !== undefined) table.height = dto.height;

    if (dto.featureIds) {
      const features = await this.featureRepository.findBy({
        id: In(dto.featureIds),
      });
      table.features = features;
    }

    return this.tableRepository.save(table);
  }

  // ── Statistics Overview ────────────────────────────────────

  async getOverview(): Promise<{
    totalReservations: number;
    activeReservations: number;
    noShowCount: number;
    cancelledReservations: number;
    occupancyRate: number;
  }> {
    const now = new Date();

    const [
      totalReservations,
      activeReservations,
      noShowCount,
      cancelledReservations,
    ] = await Promise.all([
      this.reservationRepository.count(),
      this.reservationRepository.count({
        where: {
          status: In([
            ReservationStatus.RESERVED,
            ReservationStatus.CHECKED_IN,
          ]),
        },
      }),
      this.reservationRepository.count({
        where: {
          status: In([ReservationStatus.NO_SHOW, ReservationStatus.EXPIRED]),
        },
      }),
      this.reservationRepository.count({
        where: { status: ReservationStatus.CANCELLED },
      }),
    ]);

    const totalTables = await this.tableRepository.count({
      where: { isActive: true },
    });
    const occupiedCount = await this.tableLockRepository
      .createQueryBuilder('l')
      .where('l.status = :s', { s: LockStatus.ACTIVE })
      .andWhere('l.lock_start <= :now', { now })
      .andWhere('l.lock_end > :now', { now })
      .getCount();

    const occupancyRate =
      totalTables > 0 ? (occupiedCount / totalTables) * 100 : 0;

    return {
      totalReservations,
      activeReservations,
      noShowCount,
      cancelledReservations,
      occupancyRate,
    };
  }

  // ── Special Periods (Admin Managed) ────────────────────────

  async getSpecialPeriods(): Promise<OperatingSchedule[]> {
    return this.scheduleRepository.find({
      where: { periodKind: SchedulePeriodKind.SPECIAL },
      order: {
        isActive: 'DESC',
        startDate: 'DESC',
        priority: 'DESC',
      },
    });
  }

  async createSpecialPeriod(
    dto: CreateSpecialPeriodDto,
  ): Promise<OperatingSchedule> {
    this.validateDateRange(dto.startDate, dto.endDate);
    await this.ensureNoActivePeriodOverlap(dto.startDate, dto.endDate);

    const schedule = this.scheduleRepository.create({
      name: dto.name,
      scheduleType: ScheduleType.EXAM_FINAL,
      periodKind: SchedulePeriodKind.SPECIAL,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      is24h: dto.is24h ?? true,
      openingTime: dto.openingTime ?? '00:00',
      closingTime: dto.closingTime ?? '23:59',
      maxDurationHours: 3,
      chainQrTimeoutMinutes: 15,
      priority: dto.priority ?? 100,
      rules: {
        allowAdvanceBooking: dto.rules?.allowAdvanceBooking ?? true,
        maxAdvanceDays: dto.rules?.maxAdvanceDays ?? 1,
      },
      isActive: true,
    });

    return this.scheduleRepository.save(schedule);
  }

  async updateSpecialPeriod(
    id: string,
    dto: UpdateSpecialPeriodDto,
  ): Promise<OperatingSchedule> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id, periodKind: SchedulePeriodKind.SPECIAL },
    });
    if (!schedule) {
      throw new NotFoundException('Ozel donem bulunamadi.');
    }

    const nextStartDate =
      dto.startDate ?? schedule.startDate.toISOString().slice(0, 10);
    const nextEndDate =
      dto.endDate ?? schedule.endDate.toISOString().slice(0, 10);
    this.validateDateRange(nextStartDate, nextEndDate);
    await this.ensureNoActivePeriodOverlap(nextStartDate, nextEndDate, id);

    Object.assign(schedule, {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.startDate !== undefined
        ? { startDate: new Date(dto.startDate) }
        : {}),
      ...(dto.endDate !== undefined ? { endDate: new Date(dto.endDate) } : {}),
      ...(dto.is24h !== undefined ? { is24h: dto.is24h } : {}),
      ...(dto.openingTime !== undefined
        ? { openingTime: dto.openingTime }
        : {}),
      ...(dto.closingTime !== undefined
        ? { closingTime: dto.closingTime }
        : {}),
      ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
      ...(dto.rules !== undefined
        ? {
            rules: {
              ...schedule.rules,
              ...dto.rules,
            },
          }
        : {}),
    });

    return this.scheduleRepository.save(schedule);
  }

  async toggleSpecialPeriod(
    id: string,
    dto: ToggleSpecialPeriodDto,
  ): Promise<OperatingSchedule> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id, periodKind: SchedulePeriodKind.SPECIAL },
    });
    if (!schedule) {
      throw new NotFoundException('Ozel donem bulunamadi.');
    }

    schedule.isActive = dto.isActive;
    return this.scheduleRepository.save(schedule);
  }

  async deleteSpecialPeriod(id: string): Promise<{ message: string }> {
    const schedule = await this.scheduleRepository.findOne({
      where: { id, periodKind: SchedulePeriodKind.SPECIAL },
    });
    if (!schedule) {
      throw new NotFoundException('Ozel donem bulunamadi.');
    }

    await this.scheduleRepository.remove(schedule);
    return { message: 'Ozel donem silindi.' };
  }

  private validateDateRange(startDate: string, endDate: string): void {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Gecersiz tarih degeri.');
    }
    if (start > end) {
      throw new BadRequestException(
        'Baslangic tarihi bitis tarihinden buyuk olamaz.',
      );
    }
  }

  private async ensureNoActivePeriodOverlap(
    startDate: string,
    endDate: string,
    excludeId?: string,
  ): Promise<void> {
    const where: any = {
      isActive: true,
      periodKind: SchedulePeriodKind.SPECIAL,
      startDate: LessThanOrEqual(new Date(endDate)),
      endDate: MoreThanOrEqual(new Date(startDate)),
    };
    if (excludeId) {
      where.id = Not(excludeId);
    }

    const overlaps = await this.scheduleRepository.find({
      where,
      select: ['id'],
    });

    const hasOverlap = overlaps.some((item) => item.id !== excludeId);
    if (hasOverlap) {
      throw new BadRequestException(
        'Bu tarih araliginda aktif baska bir ozel donem bulunuyor. Once mevcut donemi pasife alin.',
      );
    }
  }
}
