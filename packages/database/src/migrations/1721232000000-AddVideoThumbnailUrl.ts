import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVideoThumbnailUrl1721232000000 implements MigrationInterface {
  name = 'AddVideoThumbnailUrl1721232000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE videos
      ADD COLUMN IF NOT EXISTS "thumbnailUrl" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE videos
      DROP COLUMN IF EXISTS "thumbnailUrl"
    `);
  }
}
