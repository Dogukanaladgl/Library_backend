import { registerAs } from '@nestjs/config';

/**
 * SUMOB mobil DB (MSSQL) konfigürasyonu.
 * Bağlantı stringi:
 *   Data Source=sqldatabase.selcuk.edu.tr;Initial Catalog=mobil;Persist Security Info=True;
 *   User ID=mobil;Password=Mbl2022*;Trust Server Certificate=True
 */
export default registerAs('sumob', () => ({
  mssql: {
    server: process.env.SUMOB_MSSQL_HOST || 'sqldatabase.selcuk.edu.tr',
    port: parseInt(process.env.SUMOB_MSSQL_PORT || '1433', 10),
    database: process.env.SUMOB_MSSQL_DATABASE || 'mobil',
    user: process.env.SUMOB_MSSQL_USER || 'mobil',
    password: process.env.SUMOB_MSSQL_PASSWORD || 'Mbl2022*',
    options: {
      encrypt: true,
      trustServerCertificate: true,
      enableArithAbort: true,
    },
    pool: {
      max: parseInt(process.env.SUMOB_MSSQL_POOL_MAX || '10', 10),
      min: 0,
      idleTimeoutMillis: 30_000,
    },
    connectionTimeout: 15_000,
    requestTimeout: 15_000,
  },
  /** sp_find_user → library user cache TTL (ms). 0 = devre dışı. */
  cacheTtlMs: parseInt(process.env.SUMOB_CACHE_TTL_MS || '300000', 10),
}));
