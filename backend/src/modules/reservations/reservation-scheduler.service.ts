import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, In } from 'typeorm';
import {
  Reservation,
  ReservationStatus,
  TableLock,
  LockStatus,
  ReservationLogEvent,
} from '../../database/entities';
import { ReservationEventService } from './reservation-event.service';

const QR_WARNING_MINUTES = 25;

@Injectable()
export class ReservationSchedulerService {
  private readonly logger = new Logger(ReservationSchedulerService.name);
  private isRunning = false;

  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    @InjectRepository(TableLock)
    private readonly tableLockRepository: Repository<TableLock>,
    private readonly eventService: ReservationEventService,
  ) {}

  /**
   * Her dakika calisan ana cron job.
   * Sirasyla: QR uyari, no-show iptal, sure bitis, uzatma hatirlatma, cikis uyarisi
   */
  @Cron('* * * * *')
  async handleReservationCron(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      await this.handleQrWarnings();
      await this.handleNoShows();
      await this.handleCompletions();
      await this.handleExpiredLocks();
      await this.handleExtendReminders();
      await this.handleLeaveWarnings();
      await this.handleReReservationNotifications();
    } catch (error) {
      this.logger.error(
        'Cron job hatasi',
        error instanceof Error ? error.stack : String(error),
      );
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * 25. dakikada QR okutulmadiysa uyari event'i olustur
   */
  private async handleQrWarnings(): Promise<void> {
    const now = new Date();
    const warningThreshold = new Date(now.getTime() - QR_WARNING_MINUTES * 60 * 1000);

    const reservations = await this.reservationRepository.find({
      where: {
        status: ReservationStatus.RESERVED,
        notifQrWarningSent: false,
        startTime: LessThanOrEqual(warningThreshold),
      },
    });

    for (const reservation of reservations) {
      // QR deadline'i gecmediyse uyari gonder
      if (reservation.qrDeadline && now < reservation.qrDeadline) {
        // Atomik guncelleme: sadece hala false olanlari guncelle (race condition onleme)
        const result = await this.reservationRepository.update(
          { id: reservation.id, notifQrWarningSent: false },
          { notifQrWarningSent: true },
        );

        if (result.affected && result.affected > 0) {
          await this.eventService.log(
            ReservationLogEvent.QR_WARNING,
            reservation.id,
            reservation.userId,
            { minutesSinceStart: QR_WARNING_MINUTES },
          );

          this.logger.log(`QR uyarisi gonderildi: ${reservation.id}`);
        }
      }
    }
  }

  /**
   * 30 dakikada QR okutulmadiysa rezervasyonu NO_SHOW yap.
   * Kilidi tam serbest birakmak yerine lockEnd'i reservation.endTime'a kisaltir;
   * boylece masa orijinal rezervasyon suresi boyunca (ornegin 12-13) kilitli kalir
   * ama 3 saatlik potansiyel pencere (13-15) aninda acilir.
   * endTime gectikten sonra handleExpiredLocks kilidi serbest birakir.
   */
  private async handleNoShows(): Promise<void> {
    const now = new Date();

    const expiredReservations = await this.reservationRepository.find({
      where: {
        status: ReservationStatus.RESERVED,
        qrDeadline: LessThanOrEqual(now),
      },
    });

    for (const reservation of expiredReservations) {
      const result = await this.reservationRepository.update(
        { id: reservation.id, status: ReservationStatus.RESERVED },
        { status: ReservationStatus.NO_SHOW, cancelledAt: now },
      );

      if (result.affected && result.affected > 0) {
        if (reservation.endTime <= now) {
          await this.tableLockRepository.update(
            { reservationId: reservation.id, status: LockStatus.ACTIVE },
            { status: LockStatus.RELEASED, releasedAt: now },
          );
        } else {
          await this.tableLockRepository.update(
            { reservationId: reservation.id, status: LockStatus.ACTIVE },
            { lockEnd: reservation.endTime },
          );
        }

        await this.eventService.log(
          ReservationLogEvent.NO_SHOW,
          reservation.id,
          reservation.userId,
          { reason: 'QR timeout' },
        );

        this.logger.log(`Rezervasyon no-show olarak islendi: ${reservation.id}`);
      }
    }
  }

  /**
   * Süresi biten CHECKED_IN rezervasyonları sunucu tarafında otomatik kapatır.
   *
   * Mantık: kullanıcı `endTime` sonrası uzatma veya tamamla yapmadıysa oturum
   * sunucuda iptal edilir; gerekçe mobil ile uyumlu (`session_timeout_no_extend`)
   * şekilde kayda geçer ve masa kilidi anında serbest bırakılarak müsaitlik
   * gecikmesi engellenir. Uzatma ile `endTime` ileri taşındıysa yeni değer
   * esas alındığı için bu sorgu kaydı atlar.
   */
  private async handleCompletions(): Promise<void> {
    const now = new Date();
    const reason = 'session_timeout_no_extend';

    const expired = await this.reservationRepository.find({
      where: {
        status: ReservationStatus.CHECKED_IN,
        endTime: LessThanOrEqual(now),
      },
    });

    for (const reservation of expired) {
      // Atomik: durum hâlâ CHECKED_IN ise CANCELLED'a çevir (uzatma/tamamla ile
      // yarışı koruyalım — başka bir akış araya girdiyse atla).
      const result = await this.reservationRepository.update(
        { id: reservation.id, status: ReservationStatus.CHECKED_IN },
        {
          status: ReservationStatus.CANCELLED,
          cancelledAt: now,
          cancelledReason: reason,
        },
      );

      if (result.affected && result.affected > 0) {
        // Masa kilidini anında serbest bırak — başka kullanıcılar için müsaitlik
        // gecikmesin.
        await this.tableLockRepository.update(
          { reservationId: reservation.id, status: LockStatus.ACTIVE },
          { status: LockStatus.RELEASED, releasedAt: now },
        );

        await this.eventService.log(
          ReservationLogEvent.CANCELLED,
          reservation.id,
          reservation.userId,
          {
            reason,
            cancelledAt: now.toISOString(),
            source: 'server_scheduler',
          },
        );

        this.logger.log(
          `Oturum süresi doldu, sunucu iptal etti: ${reservation.id} (${reason})`,
        );
      }
    }
  }

  /**
   * Bitis zamanindan 15 dk once uzatma hatirlatmasi
   */
  private async handleExtendReminders(): Promise<void> {
    const now = new Date();
    const reminderWindow = new Date(now.getTime() + 15 * 60 * 1000);

    const reservations = await this.reservationRepository.find({
      where: {
        status: ReservationStatus.CHECKED_IN,
        notifExtendReminderSent: false,
        endTime: LessThanOrEqual(reminderWindow),
      },
    });

    for (const reservation of reservations) {
      // Sadece uzatma hakki olanlara gonder
      if (reservation.extensionCount < 2 && reservation.endTime > now) {
        // Atomik guncelleme: sadece hala false olanlari guncelle
        const result = await this.reservationRepository.update(
          { id: reservation.id, notifExtendReminderSent: false },
          { notifExtendReminderSent: true },
        );

        if (result.affected && result.affected > 0) {
          await this.eventService.log(
            ReservationLogEvent.EXTEND_REMINDER,
            reservation.id,
            reservation.userId,
            { extensionsRemaining: 2 - reservation.extensionCount },
          );

          this.logger.log(`Uzatma hatirlatmasi gonderildi: ${reservation.id}`);
        }
      }
    }
  }

  /**
   * Bitis zamanindan 10 dk once cikis uyarisi
   */
  private async handleLeaveWarnings(): Promise<void> {
    const now = new Date();
    const warningWindow = new Date(now.getTime() + 10 * 60 * 1000);

    const reservations = await this.reservationRepository.find({
      where: {
        status: ReservationStatus.CHECKED_IN,
        notifLeaveWarningSent: false,
        endTime: LessThanOrEqual(warningWindow),
      },
    });

    for (const reservation of reservations) {
      if (reservation.endTime > now) {
        // Atomik guncelleme: sadece hala false olanlari guncelle
        const result = await this.reservationRepository.update(
          { id: reservation.id, notifLeaveWarningSent: false },
          { notifLeaveWarningSent: true },
        );

        if (result.affected && result.affected > 0) {
          await this.eventService.log(
            ReservationLogEvent.LEAVE_WARNING,
            reservation.id,
            reservation.userId,
            { minutesRemaining: Math.ceil((reservation.endTime.getTime() - now.getTime()) / 60000) },
          );

          this.logger.log(`Cikis uyarisi gonderildi: ${reservation.id}`);
        }
      }
    }
  }

  /**
   * 2. uzatma kullanildiktan sonra, son kullanimin bitisine 30 dk kala
   * yeniden rezervasyon bildirimi
   * Not: notifQrExpiredSent flag'i bu amac icin kullaniliyor (entity'ye yeni alan eklemeden)
   */
  private async handleReReservationNotifications(): Promise<void> {
    const now = new Date();
    const notifWindow = new Date(now.getTime() + 30 * 60 * 1000);

    const reservations = await this.reservationRepository.find({
      where: {
        status: ReservationStatus.CHECKED_IN,
        extensionCount: 2,
        notifQrExpiredSent: false, // Bu flag'i yeniden-rezervasyon bildirimi icin kullaniyoruz
        endTime: LessThanOrEqual(notifWindow),
      },
    });

    for (const reservation of reservations) {
      if (reservation.endTime > now) {
        // Atomik guncelleme: sadece hala false olanlari guncelle
        const result = await this.reservationRepository.update(
          { id: reservation.id, notifQrExpiredSent: false },
          { notifQrExpiredSent: true },
        );

        if (result.affected && result.affected > 0) {
          // Event log (metadata ile ayirt edilebilir)
          await this.eventService.log(
            ReservationLogEvent.EXTEND_REMINDER, // Mevcut event kullaniliyor, metadata ile ayirt ediliyor
            reservation.id,
            reservation.userId,
            { type: 're_reservation_notification', minutesRemaining: Math.ceil((reservation.endTime.getTime() - now.getTime()) / 60000) },
          );

          this.logger.log(
            `Yeniden rezervasyon bildirimi hazir: ${reservation.id}`,
          );
        }
      }
    }
  }

  /**
   * lockEnd suresi gecmis ama hala ACTIVE olan kilitleri serbest birakir.
   * No-show sonrasi kisaltilmis kilitler ve diger edge-case'ler icin guvenlik agi.
   */
  private async handleExpiredLocks(): Promise<void> {
    const now = new Date();
    const result = await this.tableLockRepository
      .createQueryBuilder()
      .update(TableLock)
      .set({ status: LockStatus.RELEASED, releasedAt: now })
      .where('status = :s', { s: LockStatus.ACTIVE })
      .andWhere('lock_end <= :now', { now })
      .execute();

    if (result.affected && result.affected > 0) {
      this.logger.log(`Suresi gecmis ${result.affected} kilit serbest birakildi.`);
    }
  }
}
