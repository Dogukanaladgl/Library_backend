import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  type: 'postgres' as const,
  /** Set oldugunda TypeORM bu URL uzerinden baglanir; yoksa host/port/DB_* kullanilir */
  url: process.env.DATABASE_URL?.trim() || undefined,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'library_user',
  password: process.env.DB_PASSWORD || 'library_pass_2025',
  database: process.env.DB_DATABASE || 'library_reservation',
  autoLoadEntities: true,
  /**
   * `synchronize` HER ZAMAN açık-rıza ile çalışmalı. Aksi halde TypeORM
   * entity'lere bakıp mevcut tabloları değiştirebilir (ALTER/DROP). Üretimde
   * ve geliştirmede aynı kural geçerli; şema değişikliği yalnızca migration
   * ile yapılır. Yalnızca DB_SYNCHRONIZE=true ise true döner.
   */
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  logging:
    process.env.DB_LOGGING === 'true' || process.env.NODE_ENV === 'development',
}));

