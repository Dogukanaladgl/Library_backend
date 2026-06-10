import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHallAvailabilityTables1778530000000 implements MigrationInterface {
  name = 'AddHallAvailabilityTables1778530000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."hall_availability_exceptions_exception_type_enum" AS ENUM('open', 'closed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "hall_availability_exceptions" (
        "id" uuid NOT NULL,
        "hall_id" uuid NOT NULL,
        "exception_date" date NOT NULL,
        "start_time" TIME NOT NULL,
        "end_time" TIME NOT NULL,
        "exception_type" "public"."hall_availability_exceptions_exception_type_enum" NOT NULL DEFAULT 'closed',
        "reason" character varying(255),
        "created_by" uuid,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hall_availability_exceptions" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_hall_availability_exceptions_hall_date"
       ON "hall_availability_exceptions" ("hall_id", "exception_date")`,
    );
    await queryRunner.query(
      `ALTER TABLE "hall_availability_exceptions"
       ADD CONSTRAINT "FK_hall_availability_exceptions_hall"
       FOREIGN KEY ("hall_id") REFERENCES "halls"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "hall_availability_exceptions"
       ADD CONSTRAINT "FK_hall_availability_exceptions_user"
       FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."hall_closures_reason_enum" AS ENUM('inventory_count', 'cleaning', 'maintenance', 'other')`,
    );
    await queryRunner.query(
      `CREATE TABLE "hall_closures" (
        "id" uuid NOT NULL,
        "hall_id" uuid,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "reason" "public"."hall_closures_reason_enum" NOT NULL DEFAULT 'other',
        "note" text,
        "created_by" uuid,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_hall_closures" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_hall_closures_hall_dates"
       ON "hall_closures" ("hall_id", "start_date", "end_date")`,
    );
    await queryRunner.query(
      `ALTER TABLE "hall_closures"
       ADD CONSTRAINT "FK_hall_closures_hall"
       FOREIGN KEY ("hall_id") REFERENCES "halls"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "hall_closures"
       ADD CONSTRAINT "FK_hall_closures_user"
       FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "hall_closures" DROP CONSTRAINT "FK_hall_closures_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hall_closures" DROP CONSTRAINT "FK_hall_closures_hall"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_hall_closures_hall_dates"`);
    await queryRunner.query(`DROP TABLE "hall_closures"`);
    await queryRunner.query(`DROP TYPE "public"."hall_closures_reason_enum"`);

    await queryRunner.query(
      `ALTER TABLE "hall_availability_exceptions" DROP CONSTRAINT "FK_hall_availability_exceptions_user"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hall_availability_exceptions" DROP CONSTRAINT "FK_hall_availability_exceptions_hall"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_hall_availability_exceptions_hall_date"`,
    );
    await queryRunner.query(`DROP TABLE "hall_availability_exceptions"`);
    await queryRunner.query(
      `DROP TYPE "public"."hall_availability_exceptions_exception_type_enum"`,
    );
  }
}
