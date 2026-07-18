import 'reflect-metadata';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { createDataSource } from './data-source';
import { ensureVectorExtension } from './pgvector';

function loadEnv() {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../../.env'),
    path.resolve(__dirname, '../../../../.env')
  ];
  const envPath = candidates.find((candidate) => existsSync(candidate));
  if (envPath && typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envPath);
  }
}

loadEnv();

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const synchronize = process.env.TYPEORM_SYNC === 'true';

  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  await ensureVectorExtension(databaseUrl);
  const dataSource = createDataSource(databaseUrl, synchronize);
  await dataSource.initialize();

  if (synchronize) {
    console.log('Schema synchronized via TYPEORM_SYNC=true');
  } else {
    await dataSource.runMigrations();
    console.log('Migrations completed');
  }

  await dataSource.destroy();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
