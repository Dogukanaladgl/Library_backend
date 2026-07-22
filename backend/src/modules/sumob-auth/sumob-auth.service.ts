import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../../database/entities';
import { MobilDbService, MobilUserRow } from './mobil-db.service';

export interface ResolvedSumobUser {
  /**
   * Library `users` tablosundaki uuid. Sadece rezervasyon/log FK'leri için
   * lazy provision edilir; ilk rezervasyon yapılana kadar boş string olabilir.
   * Profil verisi (ad, kurumNo, e-posta, vs.) library'de saklanmaz; her
   * istekte SUMOB `sp_find_user` çıktısından doldurulur.
   */
  id: string;
  /** SUMOB `kurumNo` (öğrenci/personel numarası). */
  studentNumber: string;
  /** SUMOB `adi soyadi` (her istekte SUMOB'tan tazelenir). */
  fullName: string;
  /** SUMOB e-posta (varsa). */
  email: string | null;
  /** SUMOB fakülte adı (varsa). */
  facultyName: string | null;
  /** SUMOB bölüm adı (varsa). */
  departmentName: string | null;
  /** Library tarafında atanmış rol (student/admin/staff). SUMOB'da yoktur. */
  role: UserRole;
  /** Library tarafında işaretlenmiş super admin bayrağı. */
  isSuperAdmin: boolean;
  /** Yarı zamanlı salon görevlisi bayrağı (student rolü + staff paneli). */
  isStaffMember: boolean;
  /** SUMOB mobil DB userKey (cache anahtarı / audit). */
  sumobUserKey: string;
  /** SUMOB mobil DB Users.id (int). */
  sumobUserId: number;
}

interface CacheEntry {
  value: ResolvedSumobUser;
  expiresAt: number;
}

/**
 * Mobile’dan gelen `userKey` + `deviceKey` header’larını:
 *  1) `sp_find_user` ile SUMOB mobil DB’sine doğrulatır
 *  2) Dönen `kurumNo`’yu library `users.studentNumber` ile eşleştirir (yoksa oluşturur)
 *  3) İstek bağlamına oturtulacak [ResolvedSumobUser] döner
 *
 * Sonucu kısa TTL (varsayılan 5dk) ile in-memory cache’ler.
 */
@Injectable()
export class SumobAuthService {
  private readonly logger = new Logger(SumobAuthService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly mobilDb: MobilDbService,
    private readonly config: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async resolve(
    deviceKey: string | undefined,
    userKey: string | undefined,
  ): Promise<ResolvedSumobUser> {
    if (!deviceKey || !userKey) {
      throw new UnauthorizedException(
        'SUMOB oturum bilgisi eksik (deviceKey/userKey).',
      );
    }

    const cacheKey = `${deviceKey}::${userKey}`;
    const ttlMs = this.config.get<number>('sumob.cacheTtlMs') ?? 0;
    const now = Date.now();

    if (ttlMs > 0) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        return cached.value;
      }
    }

    const row = await this.mobilDb.findUser(deviceKey, userKey);
    if (!row) {
      throw new UnauthorizedException(
        'SUMOB oturumu geçersiz. Lütfen tekrar giriş yapın.',
      );
    }

    const studentNumber = (row.kurumNo ?? '').toString().trim();
    if (!studentNumber) {
      throw new UnauthorizedException(
        'Kullanıcının kurum numarası SUMOB üzerinde tanımlı değil.',
      );
    }

    const fullName = buildFullName(row) || studentNumber;

    // Var olan library satırını oku; yoksa varsayılan rol student.
    // Provisioning (yeni satır yaratma) burada YAPILMAZ — o yalnızca write
    // path'te (rezervasyon) gerçekleşir.
    const libUser = await this.userRepository.findOne({
      where: { studentNumber },
    });
    if (libUser && libUser.isActive === false) {
      throw new UnauthorizedException(
        'Kullanıcı kütüphane sisteminde devre dışı bırakılmış.',
      );
    }

    // Ad senkronu (self-heal): `users.full_name` eskiden kurumNo olarak
    // yazılıyordu; bu yüzden yetkili ekranlarında (rezervasyon listesi, masa
    // snapshot) isim yerine numara görünüyordu. SUMOB'dan gelen gerçek ad
    // farklıysa satırı tek seferlik düzeltir — yeni satır YARATMAZ, sadece
    // mevcut adı tazeler. Düzeldikten sonra koşul sağlanmaz, tekrar yazmaz.
    if (
      libUser &&
      fullName &&
      fullName !== studentNumber &&
      libUser.fullName !== fullName
    ) {
      try {
        await this.userRepository.update({ id: libUser.id }, { fullName });
        libUser.fullName = fullName;
      } catch (e) {
        this.logger.warn(
          `full_name senkronu başarısız (${studentNumber}): ${String(e)}`,
        );
      }
    }

    const resolved: ResolvedSumobUser = {
      id: libUser?.id ?? '',
      studentNumber,
      fullName,
      email: pickString(row, ['ePosta', 'eposta', 'email']),
      facultyName: pickString(row, [
        'fakulteAdi',
        'fakulte',
        'fakulteAd',
        'birimAdi',
      ]),
      departmentName: pickString(row, [
        'bolumAdi',
        'bolum',
        'bolumAd',
        'programAdi',
      ]),
      role: libUser?.role ?? UserRole.STUDENT,
      isSuperAdmin: !!libUser?.isSuperAdmin,
      isStaffMember: !!libUser?.isStaffMember,
      sumobUserKey: userKey,
      sumobUserId: row.id,
    };

    if (ttlMs > 0) {
      this.cache.set(cacheKey, { value: resolved, expiresAt: now + ttlMs });
    }
    return resolved;
  }

  /** İstendiğinde (örn. force-logout) cache temizleme. */
  invalidate(userKey?: string): void {
    if (!userKey) {
      this.cache.clear();
      return;
    }
    for (const key of this.cache.keys()) {
      if (key.endsWith(`::${userKey}`)) this.cache.delete(key);
    }
  }

  /** Library uuid’ye göre cache temizle (force-logout senaryosu için). */
  invalidateByUserId(userId: string): void {
    for (const [key, entry] of this.cache.entries()) {
      if (entry.value.id === userId) this.cache.delete(key);
    }
  }

  /**
   * Rezervasyon FK'si için library satırını lazy provision eder. Sadece write
   * path'lerden (rezervasyon yaratma) çağrılır; read path'lerinde çağırma.
   *
   * [fullName] verilirse `users.full_name`'e gerçek ad yazılır. Yetkili
   * ekranları (rezervasyon listesi, masa snapshot) bu kolondan okuduğu için
   * ad yoksa numara görünür. Verilmezse geriye dönük olarak studentNumber.
   */
  async ensureLibraryUserId(
    studentNumber: string,
    fullName?: string,
  ): Promise<string> {
    const realName = fullName?.trim();
    const existing = await this.userRepository.findOne({
      where: { studentNumber },
    });
    if (existing) {
      if (existing.isActive === false) {
        throw new UnauthorizedException(
          'Kullanıcı kütüphane sisteminde devre dışı bırakılmış.',
        );
      }
      // Eski kayıtlarda ad kurumNo olarak yazılmıştı; gerçek ad geldiyse düzelt.
      if (realName && realName !== studentNumber && existing.fullName !== realName) {
        try {
          await this.userRepository.update(
            { id: existing.id },
            { fullName: realName },
          );
        } catch (e) {
          this.logger.warn(
            `full_name güncellenemedi (${studentNumber}): ${String(e)}`,
          );
        }
      }
      return existing.id;
    }
    const created = this.userRepository.create({
      studentNumber,
      fullName: realName || studentNumber,
      role: UserRole.STUDENT,
      isActive: true,
      isSuperAdmin: false,
    });
    const saved = await this.userRepository.save(created);
    return saved.id;
  }
}

function buildFullName(row: MobilUserRow): string {
  const first = (row.adi ?? '').toString().trim();
  const last = (row.soyadi ?? '').toString().trim();
  return [first, last].filter(Boolean).join(' ').trim();
}

function pickString(
  row: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}
