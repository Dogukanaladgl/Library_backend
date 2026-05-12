import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../../database/entities';
import { MobilDbService, MobilUserRow } from './mobil-db.service';

export interface ResolvedSumobUser {
  /** Library `users` tablosundaki uuid. */
  id: string;
  studentNumber: string;
  fullName: string;
  role: UserRole;
  isSuperAdmin: boolean;
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

    const fullName = buildFullName(row);
    const libUser = await this.upsertLibraryUser(studentNumber, fullName);

    const resolved: ResolvedSumobUser = {
      id: libUser.id,
      studentNumber: libUser.studentNumber,
      fullName: libUser.fullName,
      role: libUser.role,
      isSuperAdmin: !!libUser.isSuperAdmin,
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

  private async upsertLibraryUser(
    studentNumber: string,
    fullName: string,
  ): Promise<User> {
    const existing = await this.userRepository.findOne({
      where: { studentNumber },
    });
    if (existing) {
      // Aktif değilse 401 verelim ki admin manuel tekrar açabilsin.
      if (!existing.isActive) {
        throw new UnauthorizedException(
          'Kullanıcı kütüphane sisteminde devre dışı bırakılmış.',
        );
      }
      // İsim güncel değilse senkronize et (sessizce).
      if (fullName && existing.fullName !== fullName) {
        existing.fullName = fullName;
        try {
          await this.userRepository.save(existing);
        } catch (err) {
          this.logger.warn(`User fullName güncellenemedi: ${err}`);
        }
      }
      return existing;
    }

    const created = this.userRepository.create({
      studentNumber,
      fullName: fullName || studentNumber,
      role: UserRole.STUDENT,
      isActive: true,
      isSuperAdmin: false,
      passwordHash: '',
    });
    return this.userRepository.save(created);
  }
}

function buildFullName(row: MobilUserRow): string {
  const first = (row.adi ?? '').toString().trim();
  const last = (row.soyadi ?? '').toString().trim();
  return [first, last].filter(Boolean).join(' ').trim();
}
