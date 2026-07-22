import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ölü kolon temizliği: `users.password_hash`.
 *
 * Parola-tabanlı login kaldırıldı; kimlik doğrulama artık SUMOB
 * (`sp_find_user`, userKey/deviceKey) ve web panelde University
 * (`Auth/Login` + `HasPermission`) üzerinden yapılıyor. `password_hash`
 * yalnızca boş string ('') yazılıp hiçbir yerde OKUNMUYORDU → gerçek ölü kolon.
 *
 * NOT — `is_super_admin` KASITLI OLARAK kaldırılmadı: backend bir yetki kapısı
 * olarak kullanmıyor ama mobil backoffice süper-admin hesaplarını korumak için
 * (rol değiştirme / oturum sonlandırma butonlarını gizlemek) bu bayrağı
 * okuyor. Silmek o korumayı sessizce devre dışı bırakırdı.
 */
export class DropDeadPasswordHash1778540000000 implements MigrationInterface {
  name = 'DropDeadPasswordHash1778540000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "password_hash"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Geri alma: kolonu geriye dönük olarak (boş string varsayılanıyla) ekler.
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" character varying(255) NOT NULL DEFAULT ''`,
    );
  }
}
