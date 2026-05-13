import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Profil yönetimi tamamen SUMOB mobil DB'sine devredildi.
 * Library DB'sinde kullanılmayan iki tabloyu temizliyoruz:
 *  - user_preferences: tercih/cache; SUMOB cevabından runtime'da türetilir.
 *  - user_sessions: JWT döneminden kalma; SUMOB sp_find_user her istekte yetkilendirir.
 */
export class DropUserProfileTables1778510000000 implements MigrationInterface {
  name = 'DropUserProfileTables1778510000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "user_sessions" CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_preferences" CASCADE`);
  }

  public async down(): Promise<void> {
    // Geri dönüş yok; tablolar tekrar gerekirse InitialSchema yeniden yazılır.
  }
}
