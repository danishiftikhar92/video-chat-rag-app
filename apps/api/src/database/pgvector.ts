import type { DataSource, QueryRunner } from 'typeorm';
import { DataSource as TypeOrmDataSource } from 'typeorm';

const DEFAULT_DIMENSIONS = 384;

const resolveDimensions = (dimensions?: number) => {
  if (dimensions && Number.isFinite(dimensions) && dimensions > 0) return dimensions;
  const fromEnv = Number.parseInt(process.env.EMBEDDING_DIMENSIONS ?? '', 10);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_DIMENSIONS;
};

/** Enable pgvector before TypeORM synchronize tries to create vector columns. */
export const ensureVectorExtension = async (databaseUrl: string): Promise<void> => {
  const bootstrap = new TypeOrmDataSource({
    type: 'postgres',
    url: databaseUrl,
    synchronize: false
  });
  await bootstrap.initialize();
  try {
    await bootstrap.query('CREATE EXTENSION IF NOT EXISTS vector');
  } finally {
    await bootstrap.destroy();
  }
};

/**
 * Ensures the pgvector extension exists and transcript_chunks.embedding is vector(N).
 * Safe to call on every boot (including TYPEORM_SYNC=true).
 */
export const ensurePgVector = async (dataSource: DataSource, dimensions?: number): Promise<void> => {
  const dims = resolveDimensions(dimensions);
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS vector');
    await migrateEmbeddingColumn(queryRunner, dims);
    try {
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS transcript_chunks_embedding_hnsw_idx
        ON transcript_chunks
        USING hnsw (embedding vector_cosine_ops)
      `);
    } catch {
      // Index creation can fail on empty/legacy schemas; retrieval still works via sequential scan.
    }
  } finally {
    await queryRunner.release();
  }
};

const migrateEmbeddingColumn = async (queryRunner: QueryRunner, dims: number) => {
  const tableExists = await queryRunner.query(`
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'transcript_chunks'
    LIMIT 1
  `);

  if (!tableExists.length) {
    return;
  }

  const columns = await queryRunner.query(`
    SELECT udt_name, data_type
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
    return;
  }

  const udtName = String(columns[0].udt_name ?? '');
  if (udtName === 'vector') {
    try {
      await queryRunner.query(`
        ALTER TABLE transcript_chunks
        ALTER COLUMN embedding TYPE vector(${dims})
        USING CASE
          WHEN embedding IS NULL THEN NULL
          ELSE embedding::vector(${dims})
        END
      `);
    } catch {
      // Existing vectors may have a different dimension; leave as-is until re-ingest.
    }
    return;
  }

  await queryRunner.query('ALTER TABLE transcript_chunks DROP COLUMN IF EXISTS embedding');
  await queryRunner.query(`
    ALTER TABLE transcript_chunks
    ADD COLUMN embedding vector(${dims})
  `);
};
