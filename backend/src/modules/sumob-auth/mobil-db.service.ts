import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mssql from 'mssql';

export interface MobilUserRow {
  id: number;
  userHash: string;
  userKey: string;
  tcNo?: string | null;
  adi?: string | null;
  soyadi?: string | null;
  kurumNo?: string | null;
  ePosta?: string | null;
  [key: string]: unknown;
}

/**
 * SUMOB mobil (MSSQL) DB üzerinde `dbo.sp_find_user` çağrısı yapar.
 * SP imzası: `@DeviceHash nvarchar(1000), @UserHash nvarchar(1000)`
 * Başarılı dönüşte tek satır `[Users]` döner (id, userHash, userKey, tcNo, adi, soyadi, kurumNo, ePosta, ...).
 * Başarısız (sessiz: deviceId / userId bulunamadı) → RETURN 0; recordset boş gelir → `null` döneriz.
 */
@Injectable()
export class MobilDbService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MobilDbService.name);
  private pool?: mssql.ConnectionPool;
  private connectPromise?: Promise<mssql.ConnectionPool>;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit(): Promise<void> {
    // Bağlantıyı tembel kuruyoruz; ilk istekte init olur.
    void this.getPool().catch((err) => {
      this.logger.error(
        `SUMOB mobil DB bağlantısı kurulamadı (lazy init): ${err?.message ?? err}`,
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.pool) {
      try {
        await this.pool.close();
      } catch (err) {
        this.logger.warn(`SUMOB mobil DB pool kapatılamadı: ${err}`);
      }
    }
  }

  private buildConfig(): mssql.config {
    const cfg = this.config.get<any>('sumob.mssql');
    return {
      server: cfg.server,
      port: cfg.port,
      database: cfg.database,
      user: cfg.user,
      password: cfg.password,
      options: cfg.options,
      pool: cfg.pool,
      connectionTimeout: cfg.connectionTimeout,
      requestTimeout: cfg.requestTimeout,
    };
  }

  private async getPool(): Promise<mssql.ConnectionPool> {
    if (this.pool?.connected) return this.pool;
    if (this.connectPromise) return this.connectPromise;
    this.connectPromise = (async () => {
      const pool = new mssql.ConnectionPool(this.buildConfig());
      pool.on('error', (err) => {
        this.logger.error(`SUMOB mobil DB pool hata: ${err?.message ?? err}`);
      });
      await pool.connect();
      this.pool = pool;
      this.logger.log('SUMOB mobil DB bağlantısı kuruldu.');
      return pool;
    })();
    try {
      return await this.connectPromise;
    } finally {
      this.connectPromise = undefined;
    }
  }

  /** `dbo.sp_find_user(@DeviceHash, @UserHash)` çağrısı; eşleşme yoksa null. */
  async findUser(
    deviceHash: string,
    userHash: string,
  ): Promise<MobilUserRow | null> {
    if (!deviceHash || !userHash) return null;
    try {
      const pool = await this.getPool();
      const req = pool.request();
      req.input('DeviceHash', mssql.NVarChar(1000), deviceHash);
      req.input('UserHash', mssql.NVarChar(1000), userHash);
      const result = await req.execute<MobilUserRow>('dbo.sp_find_user');
      const row = result.recordset?.[0];
      return row ?? null;
    } catch (err: any) {
      this.logger.error(
        `sp_find_user başarısız (deviceHash=${maskKey(deviceHash)}): ${err?.message ?? err}`,
      );
      return null;
    }
  }
}

function maskKey(s: string): string {
  if (!s) return '';
  if (s.length <= 8) return '***';
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}
