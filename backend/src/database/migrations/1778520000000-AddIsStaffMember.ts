import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Yarı zamanlı salon görevlilerini (`student` rolünde kalan ama staff
 * paneline de erişebilen) belirtmek için `users.is_staff_member` bayrağı.
 */
export class AddIsStaffMember1778520000000 implements MigrationInterface {
  name = 'AddIsStaffMember1778520000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_staff_member" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN IF EXISTS "is_staff_member"`,
    );
  }
}
