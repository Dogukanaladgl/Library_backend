import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  Reservation,
  ReservationStatus,
  Table,
  Hall,
  ReservationLogEvent,
} from '../../database/entities';
import { CheckInDto, CheckInResponseDto } from './dto';
import { getNowInTurkeyFrame } from '../../common/utils/turkey-time';
import { ReservationEventService } from './reservation-event.service';
import { isWithinRadius } from '../../common/utils/geo.util';

/** Check-in isleminde kullanilacak hata mesajlari */
const CHECK_IN_ERRORS = {
  RESERVATION_NOT_FOUND: 'Rezervasyon bulunamadi.',
  NOT_YOUR_RESERVATION: 'Bu rezervasyon size ait degil.',
  ALREADY_CHECKED_IN: 'Bu rezervasyon icin zaten check-in yapilmis.',
  INVALID_STATUS: 'Bu rezervasyon icin check-in yapilamaz. Mevcut durum: ',
  TOO_EARLY: 'Rezervasyon saatiniz henuz baslamadi. Baslangic saatinde tekrar deneyin.',
  TABLE_NOT_FOUND: 'Rezervasyona ait masa bulunamadi.',
  INVALID_QR_CODE: 'Gecersiz QR kod. Lutfen rezervasyon yaptiginiz masanin QR kodunu okutun.',
  QR_DEADLINE_EXPIRED: 'QR okutma suresi doldu. Rezervasyonunuz iptal edilebilir.',
  LOCATION_TOO_FAR: 'Konumunuz kutuphaneden cok uzak. Lutfen kutuphane binasina yaklasarak tekrar deneyin.',
  HALL_NO_COORDINATES: 'Salon konum bilgisi tanimlanmamis. Lutfen yonetici ile iletisime gecin.',
  NO_ACTIVE_RESERVATION: 'Aktif bir rezervasyonunuz bulunmuyor.',
} as const;

@Injectable()
export class CheckInService {
  private readonly logger = new Logger(CheckInService.name);

  constructor(
    @InjectRepository(Reservation)
    private readonly reservationRepository: Repository<Reservation>,
    @InjectRepository(Table)
    private readonly tableRepository: Repository<Table>,
    @InjectRepository(Hall)
    private readonly hallRepository: Repository<Hall>,
    private readonly configService: ConfigService,
    private readonly eventService: ReservationEventService,
  ) {}

  /**
   * Rezervasyon ID ile check-in yapar.
   * Tum is kurallari burada dogrulanir:
   * 1. Rezervasyon sahiplik kontrolu
   * 2. Durum kontrolu (sadece RESERVED)
   * 3. QR deadline kontrolu
   * 4. QR kod dogrulamasi (masa eslesme)
   * 5. Konum dogrulamasi (Haversine mesafe)
   * 6. Check-in guncelleme ve loglama
   */
  async checkIn(
    reservationId: string,
    userId: string,
    checkInDto: CheckInDto,
  ): Promise<CheckInResponseDto> {
    // 1. Rezervasyonu bul (iliskilerle birlikte)
    const reservation = await this.reservationRepository.findOne({
      where: { id: reservationId },
      relations: ['table', 'table.hall'],
    });

    if (!reservation) {
      throw new NotFoundException(CHECK_IN_ERRORS.RESERVATION_NOT_FOUND);
    }

    // 2. Sahiplik kontrolu
    if (reservation.userId !== userId) {
      throw new ForbiddenException(CHECK_IN_ERRORS.NOT_YOUR_RESERVATION);
    }

    // 3. Zaten check-in yapilmis mi kontrolu
    if (reservation.status === ReservationStatus.CHECKED_IN) {
      throw new BadRequestException(CHECK_IN_ERRORS.ALREADY_CHECKED_IN);
    }

    // 4. Durum kontrolu — sadece RESERVED durumunda check-in yapilabilir
    if (reservation.status !== ReservationStatus.RESERVED) {
      throw new BadRequestException(
        `${CHECK_IN_ERRORS.INVALID_STATUS}${reservation.status}`,
      );
    }

    // 5. Zaman kontrolu
    // DB'deki startTime/qrDeadline, TIMESTAMP WITHOUT TIME ZONE kolonunda yerel Turkey
    // saati (UTC+3) olarak saklanir; Node.js new Date() ise UTC doner. Karsilastirmayi
    // ayni "naive-UTC" perspektife getirmek icin now'u TZ offseti kadar ileri aliriz.
    const nowLocal = getNowInTurkeyFrame();

    if (nowLocal < reservation.startTime) {
      throw new BadRequestException(CHECK_IN_ERRORS.TOO_EARLY);
    }
    if (reservation.qrDeadline && nowLocal > reservation.qrDeadline) {
      throw new BadRequestException(CHECK_IN_ERRORS.QR_DEADLINE_EXPIRED);
    }

    // 6. Masa ve QR kod dogrulamasi
    const table = reservation.table;
    if (!table) {
      throw new NotFoundException(CHECK_IN_ERRORS.TABLE_NOT_FOUND);
    }

    if (table.qrCode !== checkInDto.qrCode) {
      this.logger.warn(
        `Check-in QR uyumsuzlugu: user=${userId}, reservation=${reservationId}, ` +
        `beklenen=${table.qrCode}, gelen=${checkInDto.qrCode}`,
      );
      throw new BadRequestException(CHECK_IN_ERRORS.INVALID_QR_CODE);
    }

    // 7. Konum dogrulamasi (zorunlu)
    const hall = table.hall;
    if (!hall) {
      // Hall iliskisi yuklenemezse dogrudan DB'den al
      const hallFromDb = await this.hallRepository.findOne({
        where: { id: reservation.hallId },
      });
      if (!hallFromDb || !hallFromDb.centerLatitude || !hallFromDb.centerLongitude) {
        throw new BadRequestException(CHECK_IN_ERRORS.HALL_NO_COORDINATES);
      }
      return this.performLocationCheckAndComplete(
        reservation,
        checkInDto,
        hallFromDb,
        nowLocal,
      );
    }

    if (!hall.centerLatitude || !hall.centerLongitude) {
      throw new BadRequestException(CHECK_IN_ERRORS.HALL_NO_COORDINATES);
    }

    return this.performLocationCheckAndComplete(
      reservation,
      checkInDto,
      hall,
      nowLocal,
    );
  }

  /**
   * Kullanicinin aktif rezervasyonu icin QR + konum ile check-in yapar.
   * Kolaylik endpointi: reservationId bilmeye gerek yok.
   */
  async checkInByQr(
    userId: string,
    checkInDto: CheckInDto,
  ): Promise<CheckInResponseDto> {
    // Kullanicinin aktif (RESERVED) rezervasyonunu bul
    const reservation = await this.reservationRepository.findOne({
      where: {
        userId,
        status: ReservationStatus.RESERVED,
      },
      relations: ['table', 'table.hall'],
      order: { createdAt: 'DESC' },
    });

    if (!reservation) {
      throw new NotFoundException(CHECK_IN_ERRORS.NO_ACTIVE_RESERVATION);
    }

    return this.checkIn(reservation.id, userId, checkInDto);
  }

  /**
   * Konum dogrulamasi yapar ve check-in islemini tamamlar.
   */
  private async performLocationCheckAndComplete(
    reservation: Reservation,
    checkInDto: CheckInDto,
    hall: Hall,
    now: Date,
  ): Promise<CheckInResponseDto> {
    const maxDistance = hall.allowedRadiusMeters
      ?? this.configService.get<number>('app.locationMaxDistanceMeters', 300);
    const accuracyToleranceCap = this.configService.get<number>(
      'app.locationAccuracyToleranceCapMeters',
      25,
    );
    const reportedAccuracy = Math.max(checkInDto.accuracyMeters ?? 0, 0);
    const dynamicTolerance = Math.min(reportedAccuracy, accuracyToleranceCap);
    const effectiveMaxDistance = maxDistance + dynamicTolerance;

    const { isWithin, distanceMeters } = isWithinRadius(
      checkInDto.latitude,
      checkInDto.longitude,
      Number(hall.centerLatitude),
      Number(hall.centerLongitude),
      effectiveMaxDistance,
    );

    // Konum bilgilerini her durumda kaydet (basarisiz denemeler icin de)
    reservation.checkInLatitude = checkInDto.latitude;
    reservation.checkInLongitude = checkInDto.longitude;
    reservation.checkInDistanceMeters = distanceMeters;

    if (!isWithin) {
      // Konum kaydet ama check-in yapma
      await this.reservationRepository.save(reservation);

      this.logger.warn(
        `Check-in konum reddi: user=${reservation.userId}, ` +
        `reservation=${reservation.id}, mesafe=${distanceMeters}m, max=${maxDistance}m, ` +
        `accuracy=${reportedAccuracy}m, tolerans=${dynamicTolerance}m`,
      );

      throw new BadRequestException(
        `${CHECK_IN_ERRORS.LOCATION_TOO_FAR} ` +
        `Mesafeniz: ${Math.round(distanceMeters)}m, ` +
        `izin verilen: ${Math.round(effectiveMaxDistance)}m.`,
      );
    }

    // Check-in basarili — durumu guncelle
    reservation.status = ReservationStatus.CHECKED_IN;
    reservation.checkedInAt = now;

    const saved = await this.reservationRepository.save(reservation);

    // Log kaydi
    await this.eventService.log(
      ReservationLogEvent.CHECKED_IN,
      reservation.id,
      reservation.userId,
      {
        checkedInAt: now.toISOString(),
        distanceMeters,
        latitude: checkInDto.latitude,
        longitude: checkInDto.longitude,
        qrCode: checkInDto.qrCode,
      },
    );

    this.logger.log(
      `Check-in basarili: user=${reservation.userId}, ` +
      `reservation=${reservation.id}, mesafe=${distanceMeters}m`,
    );

    return {
      message: 'Check-in basarili.',
      status: saved.status,
      checkedInAt: saved.checkedInAt,
      tableId: saved.tableId,
      hallId: saved.hallId,
      reservationId: saved.id,
      distanceMeters,
    };
  }

  /**
   * QR kodun gecerli bir masaya ait olup olmadigini dogrular.
   */
  async validateQrCode(qrCode: string): Promise<{
    isValid: boolean;
    table?: Table;
    message?: string;
  }> {
    const table = await this.tableRepository.findOne({
      where: { qrCode, isActive: true },
      relations: ['hall', 'features'],
    });

    if (!table) {
      return {
        isValid: false,
        message: 'Gecersiz QR kod.',
      };
    }

    return {
      isValid: true,
      table,
    };
  }
}
