import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGuardRails1721400000000 implements MigrationInterface {
  name = 'CreateGuardRails1721400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "guard_rails_type_enum" AS ENUM (
          'prompt_injection',
          'pii_mask',
          'scope',
          'harmful_content'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      DO $$ BEGIN
        CREATE TYPE "guard_rails_direction_enum" AS ENUM (
          'input',
          'output',
          'both'
        );
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "guard_rails" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "description" text,
        "type" "guard_rails_type_enum" NOT NULL,
        "direction" "guard_rails_direction_enum" NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "priority" integer NOT NULL DEFAULT 100,
        "config" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "guard_rails"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "guard_rails_direction_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "guard_rails_type_enum"`);
  }
}
