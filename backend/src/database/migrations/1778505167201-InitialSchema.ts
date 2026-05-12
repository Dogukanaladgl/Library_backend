import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1778505167201 implements MigrationInterface {
    name = 'InitialSchema1778505167201'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "table_features" ("id" uuid NOT NULL, "code" character varying(50) NOT NULL, "name" character varying(100) NOT NULL, "icon" character varying(50) NOT NULL, "description" text, "display_order" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_0f56e2300c916d1cf58f71e326e" UNIQUE ("code"), CONSTRAINT "PK_312f7085c0bbec5c8689b1a76fa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('student', 'admin', 'staff')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL, "student_number" character varying(50) NOT NULL, "password_hash" character varying(255) NOT NULL, "full_name" character varying(150) NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'student', "is_active" boolean NOT NULL DEFAULT true, "is_super_admin" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_597e6ab3c02d28cdedd85cd85f9" UNIQUE ("student_number"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."reservations_status_enum" AS ENUM('reserved', 'checked_in', 'completed', 'cancelled', 'expired', 'no_show')`);
        await queryRunner.query(`CREATE TABLE "reservations" ("id" uuid NOT NULL, "user_id" uuid NOT NULL, "table_id" uuid NOT NULL, "hall_id" uuid NOT NULL, "reservation_date" date NOT NULL, "start_time" TIMESTAMP NOT NULL, "end_time" TIMESTAMP NOT NULL, "lock_end_time" TIMESTAMP NOT NULL, "duration_hours" integer NOT NULL DEFAULT '1', "extension_count" integer NOT NULL DEFAULT '0', "is_chain" boolean NOT NULL DEFAULT false, "chain_id" uuid, "chain_sequence" integer NOT NULL DEFAULT '1', "previous_reservation_id" uuid, "status" "public"."reservations_status_enum" NOT NULL DEFAULT 'reserved', "checked_in_at" TIMESTAMP, "check_in_latitude" numeric(10,8), "check_in_longitude" numeric(11,8), "check_in_distance_meters" numeric(8,2), "qr_deadline" TIMESTAMP, "notif_qr_warning_sent" boolean NOT NULL DEFAULT false, "notif_qr_expired_sent" boolean NOT NULL DEFAULT false, "notif_extend_reminder_sent" boolean NOT NULL DEFAULT false, "notif_leave_warning_sent" boolean NOT NULL DEFAULT false, "cancelled_at" TIMESTAMP, "cancelled_reason" character varying(255), "completed_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_da95cef71b617ac35dc5bcda243" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."tables_status_enum" AS ENUM('available', 'maintenance', 'reserved')`);
        await queryRunner.query(`CREATE TABLE "tables" ("id" uuid NOT NULL, "hall_id" uuid NOT NULL, "table_number" character varying(20) NOT NULL, "position_x" integer NOT NULL, "position_y" integer NOT NULL, "width" integer NOT NULL DEFAULT '40', "height" integer NOT NULL DEFAULT '40', "rotation" integer NOT NULL DEFAULT '0', "qr_code" character varying(255) NOT NULL, "qr_generated_at" TIMESTAMP NOT NULL DEFAULT now(), "status" "public"."tables_status_enum" NOT NULL DEFAULT 'available', "is_active" boolean NOT NULL DEFAULT true, "notes" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_ac384d64cb7fb1240fcfc9c1407" UNIQUE ("qr_code"), CONSTRAINT "PK_7cf2aca7af9550742f855d4eb69" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "halls" ("id" uuid NOT NULL, "name" character varying(100) NOT NULL, "floor" integer NOT NULL, "description" text, "layout_width" integer NOT NULL, "layout_height" integer NOT NULL, "layout_background_url" character varying(500), "layout_config" jsonb, "center_latitude" numeric(10,8), "center_longitude" numeric(11,8), "allowed_radius_meters" integer NOT NULL DEFAULT '300', "capacity" integer NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "display_order" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4665c2f3b1e718e12b06278bae8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."table_locks_status_enum" AS ENUM('active', 'released', 'cancelled')`);
        await queryRunner.query(`CREATE TABLE "table_locks" ("id" uuid NOT NULL, "table_id" uuid NOT NULL, "reservation_id" uuid NOT NULL, "lock_date" date NOT NULL, "lock_start" TIMESTAMP NOT NULL, "lock_end" TIMESTAMP NOT NULL, "status" "public"."table_locks_status_enum" NOT NULL DEFAULT 'active', "release_scheduled_at" TIMESTAMP, "released_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_43084d5db9f5b459d2f51f823a0" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."reservation_logs_event_enum" AS ENUM('created', 'checked_in', 'extended', 'cancelled', 'completed', 'expired', 'no_show', 'qr_warning', 'extend_reminder', 'vacate_seat_reminder', 'extension_declined', 'leave_warning')`);
        await queryRunner.query(`CREATE TABLE "reservation_logs" ("id" uuid NOT NULL, "reservation_id" uuid NOT NULL, "user_id" character varying(100) NOT NULL, "event" "public"."reservation_logs_event_enum" NOT NULL, "metadata" jsonb, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_74871dcf9ed2c7df8d0519d6645" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."operating_schedules_schedule_type_enum" AS ENUM('normal', 'exam_midterm', 'exam_final', 'holiday')`);
        await queryRunner.query(`CREATE TYPE "public"."operating_schedules_period_kind_enum" AS ENUM('standard', 'special')`);
        await queryRunner.query(`CREATE TABLE "operating_schedules" ("id" uuid NOT NULL, "name" character varying(100) NOT NULL, "schedule_type" "public"."operating_schedules_schedule_type_enum" NOT NULL DEFAULT 'normal', "period_kind" "public"."operating_schedules_period_kind_enum" NOT NULL DEFAULT 'standard', "start_date" date NOT NULL, "end_date" date NOT NULL, "is_24h" boolean NOT NULL DEFAULT false, "opening_time" TIME NOT NULL DEFAULT '08:00', "closing_time" TIME NOT NULL DEFAULT '23:00', "max_duration_hours" integer NOT NULL DEFAULT '3', "chain_qr_timeout_minutes" integer NOT NULL DEFAULT '15', "priority" integer NOT NULL DEFAULT '0', "rules" jsonb DEFAULT '{}', "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6c5b9da111993bce7690e196093" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."notification_logs_notification_type_enum" AS ENUM('qr_warning', 'qr_expired', 'extend_reminder', 'leave_warning', 'reservation_confirmed', 'reservation_cancelled', 'check_in_success')`);
        await queryRunner.query(`CREATE TABLE "notification_logs" ("id" uuid NOT NULL, "user_id" character varying(50) NOT NULL, "reservation_id" uuid, "notification_type" "public"."notification_logs_notification_type_enum" NOT NULL, "title" character varying(200), "body" text, "sent_at" TIMESTAMP NOT NULL DEFAULT now(), "read_at" TIMESTAMP, "clicked_at" TIMESTAMP, "fcm_message_id" character varying(255), "fcm_status" character varying(50), CONSTRAINT "PK_19c524e644cdeaebfcffc284871" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user_preferences" ("id" uuid NOT NULL, "user_id" character varying(50) NOT NULL, "preferred_features" uuid array, "preferred_halls" uuid array, "notify_qr_warning" boolean NOT NULL DEFAULT true, "notify_extend_reminder" boolean NOT NULL DEFAULT true, "notify_leave_warning" boolean NOT NULL DEFAULT true, "fcm_token" character varying(500), "fcm_token_updated_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_458057fa75b66e68a275647da2e" UNIQUE ("user_id"), CONSTRAINT "PK_e8cfb5b31af61cd363a6b6d7c25" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user_sessions" ("id" uuid NOT NULL, "user_id" uuid NOT NULL, "jti" character varying(255) NOT NULL, "expires_at" TIMESTAMP NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_705c76591465aa6943b60551cd7" UNIQUE ("jti"), CONSTRAINT "PK_e93e031a5fed190d4789b6bfd83" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "table_feature_mappings" ("table_id" uuid NOT NULL, "feature_id" uuid NOT NULL, CONSTRAINT "PK_7db4ab9f9336d5482ea8d95e309" PRIMARY KEY ("table_id", "feature_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8184f88a5a49781189617fb70e" ON "table_feature_mappings" ("table_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_51a143498e3320e182da9b3124" ON "table_feature_mappings" ("feature_id") `);
        await queryRunner.query(`ALTER TABLE "reservations" ADD CONSTRAINT "FK_4af5055a871c46d011345a255a6" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reservations" ADD CONSTRAINT "FK_5027ce24b4bc5e090302b2f7754" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reservations" ADD CONSTRAINT "FK_7d21e0560b9aaed6b33311d6c1b" FOREIGN KEY ("hall_id") REFERENCES "halls"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reservations" ADD CONSTRAINT "FK_a82b1216f820ac2c184c5c0d6f3" FOREIGN KEY ("previous_reservation_id") REFERENCES "reservations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tables" ADD CONSTRAINT "FK_3228fd90773f1fa732f16ae3616" FOREIGN KEY ("hall_id") REFERENCES "halls"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "table_locks" ADD CONSTRAINT "FK_8c0efd0d8678e9f3b80df8e3576" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "table_locks" ADD CONSTRAINT "FK_d790b842ba260f81c15e677db61" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reservation_logs" ADD CONSTRAINT "FK_4194cbece7719eaae50784de32e" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "notification_logs" ADD CONSTRAINT "FK_9ced64cb7620cc822d00e66d7fa" FOREIGN KEY ("reservation_id") REFERENCES "reservations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_e9658e959c490b0a634dfc54783" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "table_feature_mappings" ADD CONSTRAINT "FK_8184f88a5a49781189617fb70ef" FOREIGN KEY ("table_id") REFERENCES "tables"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "table_feature_mappings" ADD CONSTRAINT "FK_51a143498e3320e182da9b31247" FOREIGN KEY ("feature_id") REFERENCES "table_features"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "table_feature_mappings" DROP CONSTRAINT "FK_51a143498e3320e182da9b31247"`);
        await queryRunner.query(`ALTER TABLE "table_feature_mappings" DROP CONSTRAINT "FK_8184f88a5a49781189617fb70ef"`);
        await queryRunner.query(`ALTER TABLE "user_sessions" DROP CONSTRAINT "FK_e9658e959c490b0a634dfc54783"`);
        await queryRunner.query(`ALTER TABLE "notification_logs" DROP CONSTRAINT "FK_9ced64cb7620cc822d00e66d7fa"`);
        await queryRunner.query(`ALTER TABLE "reservation_logs" DROP CONSTRAINT "FK_4194cbece7719eaae50784de32e"`);
        await queryRunner.query(`ALTER TABLE "table_locks" DROP CONSTRAINT "FK_d790b842ba260f81c15e677db61"`);
        await queryRunner.query(`ALTER TABLE "table_locks" DROP CONSTRAINT "FK_8c0efd0d8678e9f3b80df8e3576"`);
        await queryRunner.query(`ALTER TABLE "tables" DROP CONSTRAINT "FK_3228fd90773f1fa732f16ae3616"`);
        await queryRunner.query(`ALTER TABLE "reservations" DROP CONSTRAINT "FK_a82b1216f820ac2c184c5c0d6f3"`);
        await queryRunner.query(`ALTER TABLE "reservations" DROP CONSTRAINT "FK_7d21e0560b9aaed6b33311d6c1b"`);
        await queryRunner.query(`ALTER TABLE "reservations" DROP CONSTRAINT "FK_5027ce24b4bc5e090302b2f7754"`);
        await queryRunner.query(`ALTER TABLE "reservations" DROP CONSTRAINT "FK_4af5055a871c46d011345a255a6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_51a143498e3320e182da9b3124"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8184f88a5a49781189617fb70e"`);
        await queryRunner.query(`DROP TABLE "table_feature_mappings"`);
        await queryRunner.query(`DROP TABLE "user_sessions"`);
        await queryRunner.query(`DROP TABLE "user_preferences"`);
        await queryRunner.query(`DROP TABLE "notification_logs"`);
        await queryRunner.query(`DROP TYPE "public"."notification_logs_notification_type_enum"`);
        await queryRunner.query(`DROP TABLE "operating_schedules"`);
        await queryRunner.query(`DROP TYPE "public"."operating_schedules_period_kind_enum"`);
        await queryRunner.query(`DROP TYPE "public"."operating_schedules_schedule_type_enum"`);
        await queryRunner.query(`DROP TABLE "reservation_logs"`);
        await queryRunner.query(`DROP TYPE "public"."reservation_logs_event_enum"`);
        await queryRunner.query(`DROP TABLE "table_locks"`);
        await queryRunner.query(`DROP TYPE "public"."table_locks_status_enum"`);
        await queryRunner.query(`DROP TABLE "halls"`);
        await queryRunner.query(`DROP TABLE "tables"`);
        await queryRunner.query(`DROP TYPE "public"."tables_status_enum"`);
        await queryRunner.query(`DROP TABLE "reservations"`);
        await queryRunner.query(`DROP TYPE "public"."reservations_status_enum"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP TABLE "table_features"`);
    }

}
