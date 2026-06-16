import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  In,
  Not,
  LessThan,
  MoreThan,
  Between,
  EntityManager,
} from 'typeorm';
import {
  Reservation,
  ReservationStatus,
  Table,
  TableLock,
  LockStatus,
  Hall,
  ReservationLogEvent,
  SchedulePeriodKind,
} from '../../database/entities';
import { SchedulesService } from '../schedules/schedules.service';
import { HallAvailabilityService } from '../hall-availability/hall-availability.service';
import { ReservationEventService } from './reservation-event.service';
import { CreateReservationDto } from './dto';
import { getNowInTurkeyFrame } from '../../common/utils/turkey-time';

/** Sabit degerleri tek yerden yonetmek icin */
const INITIAL_DURATION_HOURS = 1;
const MAX_EXTENSION_COUNT = 2;
const EXTENSION_DURATION_HOURS = 1;
const QR_TIMEOUT_MINUTES = 30;
const EXTENSION_WINDOW_MINUTES = 15;
const LATE_RESERVATION_GRACE_MINUTES = 30;
const MAX_POTENTIAL_HOURS = 3;
const DEFAULT_SPECIAL_MAX_ADVANCE_DAYS = 1;
const MINUTE_MS = 60 * 1000;

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    @InjectRepository(Table)
    private readonly tableRepository: Repository<Table>,
    @InjectRepository(TableLock)
    private readonly tableLockRepository: Repository<TableLock>,
    @InjectRepository(Hall)
    private readonly hallRepository: Repository<Hall>,
    private readonly dataSource: DataSource,
    private readonly schedulesService: SchedulesService,
    private readonly hallAvailabilityService: HallAvailabilityService,
    private readonly eventService: ReservationEventService,
    private readonly configService: ConfigService,
  ) {}

  // ──────────────────────────────────────────────────────────────
  // Rezervasyon olustur
  // ──────────────────────────────────────────────────────────────
  async create(userId: string, dto: CreateReservationDto): Promise<Reservation> {
    const startTime = new Date(dto.startTime);
    const now = new Date();

    // 1. Tarih kontrolu: standart donemde yalnizca bugun, ozel donemde kurala gore esnetilebilir
    await this.validateReservationDatePolicy(startTime, now);

    // 2. Calisma saatleri kontrolu (startTime gecmis olamaz kontrolu de burada)
    await this.validateOperatingHours(startTime, INITIAL_DURATION_HOURS);

    // 3. Masa kontrolu
    const table = await this.tableRepository.findOne({
      where: { id: dto.tableId, isActive: true },
      relations: ['hall'],
    });
    if (!table) {
      throw new NotFoundException('Masa bulunamadi veya aktif degil.');
    }

    const endTimeForValidation = new Date(
      startTime.getTime() + INITIAL_DURATION_HOURS * 60 * 60 * 1000,
    );
    await this.hallAvailabilityService.validateReservationAllowed(
      table.hallId,
      startTime,
      endTimeForValidation,
    );

    // 4. Kullanicinin aktif rezervasyonu var mi?
    const activeReservation = await this.findActiveReservation(userId);
    if (activeReservation) {
      throw new ConflictException(
        'Zaten aktif bir rezervasyonunuz var. Yeni rezervasyon icin mevcut rezervasyonunuzu tamamlayin veya iptal edin.',
      );
    }

    // 5. Transaction ile cakisma kontrolu + olusturma
    const endTime = new Date(startTime.getTime() + INITIAL_DURATION_HOURS * 60 * 60 * 1000);
    const lockEndTime = new Date(startTime.getTime() + MAX_POTENTIAL_HOURS * 60 * 60 * 1000);
    // Gec rezervasyonda kullanicinin en azindan kisa bir QR penceresi kalir;
    // normal durumda deadline yine slot baslangicindan +30 dakikadir.
    const slotQrDeadline = new Date(startTime.getTime() + QR_TIMEOUT_MINUTES * 60 * 1000);
    const minQrWindowEnd = new Date(now.getTime() + 5 * 60 * 1000);
    const qrDeadline = slotQrDeadline > minQrWindowEnd ? slotQrDeadline : minQrWindowEnd;
    const reservationDate = new Date(startTime);
    reservationDate.setHours(0, 0, 0, 0);

    const savedReservation = await this.dataSource.transaction(
      async (manager: EntityManager) => {
        // Pessimistic lock: masa satirini kilitle
        await manager
          .createQueryBuilder(Table, 'table')
          .setLock('pessimistic_write')
          .where('table.id = :id', { id: dto.tableId })
          .getOne();

        // Ayni masa uzerinde zaman araliginda cakisan aktif rezervasyon var mi?
        const conflicting = await manager.findOne(Reservation, {
          where: {
            tableId: dto.tableId,
            status: In([ReservationStatus.RESERVED, ReservationStatus.CHECKED_IN]),
            startTime: LessThan(endTime),
            endTime: MoreThan(startTime),
          },
        });

        if (conflicting) {
          throw new ConflictException('Bu masa secilen zaman araliginda baska bir kullanici tarafindan kullaniliyor.');
        }

        // Zaman araliginda cakisan aktif kilit var mi?
        const conflictingLock = await manager.findOne(TableLock, {
          where: {
            tableId: dto.tableId,
            status: LockStatus.ACTIVE,
            lockStart: LessThan(endTime),
            lockEnd: MoreThan(startTime),
          },
        });

        if (conflictingLock) {
          throw new ConflictException('Bu masa secilen zaman araliginda musait degil.');
        }

        // Rezervasyon olustur
        const reservation = manager.create(Reservation, {
          userId,
          tableId: dto.tableId,
          hallId: table.hallId,
          reservationDate,
          startTime,
          endTime,
          lockEndTime,
          durationHours: INITIAL_DURATION_HOURS,
          extensionCount: 0,
          qrDeadline,
          status: ReservationStatus.RESERVED,
        });

        const saved = await manager.save(Reservation, reservation);

        // Masa kilidi olustur – potansiyel 3 saatlik tam pencereyi blokla.
        // Uzatma yapilmazsa handleCompletions kilidi serbest birakir.
        const tableLock = manager.create(TableLock, {
          tableId: dto.tableId,
          reservationId: saved.id,
          lockDate: reservationDate,
          lockStart: startTime,
          lockEnd: lockEndTime,
          status: LockStatus.ACTIVE,
        });

        await manager.save(TableLock, tableLock);

        return saved;
      },
    );

    // Log
    await this.eventService.log(
      ReservationLogEvent.CREATED,
      savedReservation.id,
      userId,
      { tableId: dto.tableId, hallId: table.hallId, startTime: startTime.toISOString() },
    );

    return this.findOne(savedReservation.id);
  }

  // ──────────────────────────────────────────────────────────────
  // Rezervasyon uzat (ayni rezervasyon uzerinde +1 saat)
  // ──────────────────────────────────────────────────────────────
  async extend(reservationId: string, userId: string): Promise<Reservation> {
    const reservation = await this.findOne(reservationId);

    if (reservation.userId !== userId) {
      throw new BadRequestException('Bu rezervasyon size ait degil.');
    }

    if (reservation.status !== ReservationStatus.CHECKED_IN) {
      throw new BadRequestException('Sadece check-in yapilmis rezervasyonlar uzatilabilir.');
    }

    if (reservation.extensionCount >= MAX_EXTENSION_COUNT) {
      throw new BadRequestException(
        `Maksimum uzatma hakkiniz (${MAX_EXTENSION_COUNT}) kullanildi. Yeni rezervasyon yapabilirsiniz.`,
      );
    }

    const now = this.getNowInDbLocalFrame();
    const extensionAvailability = await this.getExtensionAvailability(reservation, now);

    if (!extensionAvailability.canExtend) {
      throw new BadRequestException(
        extensionAvailability.reason ??
          'Uzatma kosullari su an saglanmiyor.',
      );
    }

    const newEndTime = extensionAvailability.newEndTime;

    // Transaction ile cakisma kontrolu + uzatma
    await this.dataSource.transaction(async (manager: EntityManager) => {
      // Pessimistic lock
      await manager
        .createQueryBuilder(Table, 'table')
        .setLock('pessimistic_write')
        .where('table.id = :id', { id: reservation.tableId })
        .getOne();

      const conflictingReservation = await manager.findOne(Reservation, {
        where: {
          tableId: reservation.tableId,
          status: In([ReservationStatus.RESERVED, ReservationStatus.CHECKED_IN]),
          id: Not(reservationId),
          startTime: LessThan(newEndTime),
          endTime: MoreThan(reservation.endTime),
        },
      });

      if (conflictingReservation) {
        throw new ConflictException('Uzatma suresi baska bir rezervasyonla cakisiyor.');
      }

      // Rezervasyonu guncelle
      await manager.update(Reservation, reservationId, {
        endTime: newEndTime,
        durationHours: reservation.durationHours + EXTENSION_DURATION_HOURS,
        extensionCount: reservation.extensionCount + 1,
        notifExtendReminderSent: false,
        notifLeaveWarningSent: false,
      });

      // Kilit lockEnd zaten lockEndTime (start+3h) ile olusturuldu;
      // uzatma suresini asmayi engelle, yoksa guncelleme yapma.
      const existingLock = await manager.findOne(TableLock, {
        where: { reservationId, status: LockStatus.ACTIVE },
      });
      if (existingLock && newEndTime > existingLock.lockEnd) {
        await manager.update(
          TableLock,
          { id: existingLock.id },
          { lockEnd: newEndTime },
        );
      }
    });

    await this.eventService.log(
      ReservationLogEvent.EXTENDED,
      reservationId,
      userId,
      {
        extensionCount: reservation.extensionCount + 1,
        newEndTime: newEndTime.toISOString(),
      },
    );

    return this.findOne(reservationId);
  }

  // ──────────────────────────────────────────────────────────────
  // Rezervasyon iptal et (masa aninda bosalir)
  // ──────────────────────────────────────────────────────────────
  async cancel(reservationId: string, userId: string, reason?: string): Promise<Reservation> {
    const reservation = await this.findOne(reservationId);

    if (reservation.userId !== userId) {
      throw new BadRequestException('Bu rezervasyon size ait degil.');
    }

    if (![ReservationStatus.RESERVED, ReservationStatus.CHECKED_IN].includes(reservation.status)) {
      throw new BadRequestException('Bu rezervasyon iptal edilemez.');
    }

    const now = new Date();

    reservation.status = ReservationStatus.CANCELLED;
    reservation.cancelledAt = now;
    if (reason) {
      reservation.cancelledReason = reason;
    }

    await this.reservationRepository.save(reservation);

    // Kilidi aninda serbest birak
    await this.releaseTableLock(reservationId, now);

    await this.eventService.log(
      ReservationLogEvent.CANCELLED,
      reservationId,
      userId,
      { reason, cancelledAt: now.toISOString() },
    );

    return this.findOne(reservationId);
  }

  // ──────────────────────────────────────────────────────────────
  // Tekil sorgular
  // ──────────────────────────────────────────────────────────────
  async findOne(id: string): Promise<Reservation> {
    const reservation = await this.reservationRepository.findOne({
      where: { id },
      relations: ['table', 'table.features', 'hall'],
    });

    if (!reservation) {
      throw new NotFoundException('Rezervasyon bulunamadi.');
    }

    return reservation;
  }

  async findByUser(userId: string): Promise<Reservation[]> {
    return this.reservationRepository.find({
      where: { userId },
      relations: ['table', 'hall'],
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async findHistoryByUser(userId: string): Promise<Reservation[]> {
    return this.reservationRepository.find({
      where: { userId },
      relations: ['table', 'hall'],
      order: { createdAt: 'DESC' },
    });
  }

  async findActiveReservation(userId: string): Promise<Reservation | null> {
    return this.reservationRepository.findOne({
      where: {
        userId,
        status: In([ReservationStatus.RESERVED, ReservationStatus.CHECKED_IN]),
      },
      relations: ['table', 'hall'],
    });
  }

  // ──────────────────────────────────────────────────────────────
  // Kullanicinin bugunki durumu
  // ──────────────────────────────────────────────────────────────
  async getUserReservationStatus(userId: string): Promise<{
    canReserve: boolean;
    reason?: string;
    hasActiveReservation: boolean;
    activeReservation: Reservation | null;
    canExtend: boolean;
    extensionBlockedByNextReservation: boolean;
    extensionsRemaining: number;
    todayReservationCount: number;
    operatingHours: { opening: string; closing: string; is24h: boolean };
  }> {
    const nowTr = getNowInTurkeyFrame();
    const today = new Date(
      Date.UTC(nowTr.getUTCFullYear(), nowTr.getUTCMonth(), nowTr.getUTCDate()),
    );
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const todayReservations = await this.reservationRepository.find({
      where: {
        userId,
        reservationDate: Between(today, tomorrow),
      },
      relations: ['table', 'hall'],
      order: { startTime: 'ASC' },
    });

    const activeReservation = await this.findActiveReservation(userId);
    const hours = await this.schedulesService.getOperatingHoursForDate(getNowInTurkeyFrame());

    let canReserve = true;
    let canExtend = false;
    let extensionBlockedByNextReservation = false;
    let extensionsRemaining = MAX_EXTENSION_COUNT;
    let reason: string | undefined;

    if (activeReservation) {
      canReserve = false;
      reason = 'Aktif bir rezervasyonunuz var.';

      extensionsRemaining = MAX_EXTENSION_COUNT - activeReservation.extensionCount;

      if (activeReservation.status === ReservationStatus.CHECKED_IN) {
        const now = this.getNowInDbLocalFrame();
        const extensionAvailability = await this.getExtensionAvailability(
          activeReservation,
          now,
        );
        canExtend = extensionAvailability.canExtend;
        extensionBlockedByNextReservation =
          extensionAvailability.extensionBlockedByNextReservation;
      }
    }

    return {
      canReserve,
      reason,
      hasActiveReservation: !!activeReservation,
      activeReservation,
      canExtend,
      extensionBlockedByNextReservation,
      extensionsRemaining,
      todayReservationCount: todayReservations.length,
      operatingHours: {
        opening: hours.openingTime,
        closing: hours.closingTime,
        is24h: hours.is24h,
      },
    };
  }

  // ──────────────────────────────────────────────────────────────
  // Kilit yonetimi (cron ve diger servisler icin public)
  // ──────────────────────────────────────────────────────────────
  async releaseTableLock(reservationId: string, releasedAt: Date): Promise<void> {
    await this.tableLockRepository.update(
      { reservationId, status: LockStatus.ACTIVE },
      {
        status: LockStatus.RELEASED,
        releasedAt,
      },
    );
  }

  // ──────────────────────────────────────────────────────────────
  // Validasyonlar (private)
  // ──────────────────────────────────────────────────────────────
  private async validateReservationDatePolicy(startTime: Date, now: Date): Promise<void> {
    // Local timezone'da bugunun baslangici (00:00:00)
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Local timezone'da startTime'un gunu
    const startDay = new Date(
      startTime.getFullYear(),
      startTime.getMonth(),
      startTime.getDate(),
    );

    const isSameDay = startDay.getTime() === today.getTime();
    if (!isSameDay) {
      const policy = await this.schedulesService.getReservationDatePolicyForDate(startDay);
      const allowAdvanceBooking =
        policy.periodKind === SchedulePeriodKind.SPECIAL &&
        (policy.rules?.allowAdvanceBooking ?? true);
      const maxAdvanceDays = Math.max(
        1,
        Number(policy.rules?.maxAdvanceDays ?? DEFAULT_SPECIAL_MAX_ADVANCE_DAYS),
      );

      const dayDiff = Math.floor(
        (startDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000),
      );

      if (!allowAdvanceBooking || dayDiff < 0 || dayDiff > maxAdvanceDays) {
        throw new BadRequestException(
          'Rezervasyonlar yalnizca bugun icin yapilabilir. Ileri tarihli rezervasyon desteklenmemektedir.',
        );
      }
    }

    // Gecmis kontrolu:
    // Slot baslangici gecmisse sadece ilk 30 dakika icinde rezervasyona izin ver.
    if (startTime.getTime() < now.getTime()) {
      const graceDeadline = new Date(
        startTime.getTime() + LATE_RESERVATION_GRACE_MINUTES * 60 * 1000,
      );
      if (now > graceDeadline) {
        throw new BadRequestException(
          `Bu saat dilimi icin rezervasyon suresi doldu. ` +
            `Sadece baslangictan sonraki ilk ${LATE_RESERVATION_GRACE_MINUTES} dakika icinde rezervasyon yapilabilir.`,
        );
      }
    }
  }

  private async validateOperatingHours(
    startTime: Date,
    durationHours: number,
  ): Promise<void> {
    // Local timezone'da tarih kontrolu (getOperatingHoursForDate ile ayni mantik)
    const dateForSchedule = new Date(startTime);
    dateForSchedule.setHours(0, 0, 0, 0);
    
    const hours = await this.schedulesService.getOperatingHoursForDate(dateForSchedule);

    if (hours.is24h) return;

    const [openH, openM] = hours.openingTime.split(':').map(Number);
    const [closeH, closeM] = hours.closingTime.split(':').map(Number);

    // Local timezone'da saat/dakika kontrolu
    const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
    const endTime = new Date(startTime.getTime() + durationHours * 60 * 60 * 1000);
    const endMinutes = endTime.getHours() * 60 + endTime.getMinutes();
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    if (startMinutes < openMinutes || endMinutes > closeMinutes) {
      throw new BadRequestException(
        `Secilen saat calisma saatleri disinda. Acilis: ${hours.openingTime}, Kapanis: ${hours.closingTime}`,
      );
    }
  }

  private async validateOperatingHoursForExtension(
    startTime: Date,
    newEndTime: Date,
  ): Promise<void> {
    const hours = await this.schedulesService.getOperatingHoursForDate(startTime);

    if (hours.is24h) return;

    const [closeH, closeM] = hours.closingTime.split(':').map(Number);
    const closeMinutes = closeH * 60 + closeM;
    const newEndMinutes = newEndTime.getHours() * 60 + newEndTime.getMinutes();

    if (newEndMinutes > closeMinutes) {
      throw new BadRequestException(
        `Uzatma calisma saatleri disina tasiyor. Kapanis: ${hours.closingTime}`,
      );
    }
  }

  private async getExtensionAvailability(
    reservation: Reservation,
    now: Date,
  ): Promise<{
    canExtend: boolean;
    extensionBlockedByNextReservation: boolean;
    newEndTime: Date;
    reason?: string;
  }> {
    const newEndTime = new Date(
      reservation.endTime.getTime() + EXTENSION_DURATION_HOURS * 60 * 60 * 1000,
    );
    const remainingMs = reservation.endTime.getTime() - now.getTime();
    const extensionWindowMs = EXTENSION_WINDOW_MINUTES * MINUTE_MS;

    if (remainingMs <= 0) {
      return {
        canExtend: false,
        extensionBlockedByNextReservation: false,
        newEndTime,
        reason: 'Rezervasyon suresi dolmus.',
      };
    }

    if (remainingMs > extensionWindowMs) {
      return {
        canExtend: false,
        extensionBlockedByNextReservation: false,
        newEndTime,
        reason: `Uzatma hakki bitis zamanindan ${EXTENSION_WINDOW_MINUTES} dakika once acilir.`,
      };
    }

    if (reservation.extensionCount >= MAX_EXTENSION_COUNT) {
      return {
        canExtend: false,
        extensionBlockedByNextReservation: false,
        newEndTime,
        reason: `Maksimum uzatma hakkiniz (${MAX_EXTENSION_COUNT}) kullanildi.`,
      };
    }

    try {
      await this.validateOperatingHoursForExtension(reservation.startTime, newEndTime);
    } catch {
      return {
        canExtend: false,
        extensionBlockedByNextReservation: false,
        newEndTime,
        reason: 'Uzatma calisma saatleri disina tasiyor.',
      };
    }

    const conflictingReservation = await this.reservationRepository.findOne({
      where: {
        tableId: reservation.tableId,
        status: In([ReservationStatus.RESERVED, ReservationStatus.CHECKED_IN]),
        id: Not(reservation.id),
        startTime: LessThan(newEndTime),
        endTime: MoreThan(reservation.endTime),
      },
    });

    const extensionBlockedByNextReservation = !!conflictingReservation;
    if (extensionBlockedByNextReservation) {
      return {
        canExtend: false,
        extensionBlockedByNextReservation: true,
        newEndTime,
        reason: 'Sonraki zaman araliginda rezervasyon oldugu icin uzatma yapilamiyor.',
      };
    }

    return {
      canExtend: true,
      extensionBlockedByNextReservation: false,
      newEndTime,
    };
  }

  /**
   * DB timestamp kolonlari timezone bilgisiz "yerel saat" mantigiyla kullaniliyor.
   * Karsilastirmalari ayni referans eksenine almak icin now'u TZ offseti kadar kaydirir.
   */
  private getNowInDbLocalFrame(): Date {
    return getNowInTurkeyFrame();
  }
}
