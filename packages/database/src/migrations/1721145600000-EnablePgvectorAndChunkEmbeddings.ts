import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnablePgvectorAndChunkEmbeddings1721145600000 implements MigrationInterface {
  name = 'EnablePgvectorAndChunkEmbeddings1721145600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const dims = Number.parseInt(process.env.EMBEDDING_DIMENSIONS ?? '384', 10) || 384;

    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS vector');

    const columns = await queryRunner.query(`
      SELECT udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'transcript_chunks'
        AND column_name = 'embedding'
    `);

    if (!columns.length) {
      await queryRunner.query(`
        ALTER TABLE transcript_chunks
        ADD COLUMN embedding vector(${dims})
      `);
    } else if (String(columns[0].udt_name) !== 'vector') {
      await queryRunner.query('ALTER TABLE transcript_chunks DROP COLUMN embedding');
      await queryRunner.query(`
        ALTER TABLE transcript_chunks
        ADD COLUMN embedding vector(${dims})
      `);
    }

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS transcript_chunks_embedding_hnsw_idx
      ON transcript_chunks
      USING hnsw (embedding vector_cosine_ops)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS transcript_chunks_embedding_hnsw_idx');
    await queryRunner.query('ALTER TABLE transcript_chunks DROP COLUMN IF EXISTS embedding');
    await queryRunner.query(`
      ALTER TABLE transcript_chunks
      ADD COLUMN embedding jsonb
    `);
  }
}
