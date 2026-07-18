import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { getEnv } from '../config/env';
import { createTypeOrmConfig, ensurePgVector, ensureVectorExtension, entities } from './index';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: async () => {
        const env = getEnv();
        await ensureVectorExtension(env.DATABASE_URL);
        return createTypeOrmConfig(env.DATABASE_URL, env.TYPEORM_SYNC === 'true');
      },
      dataSourceFactory: async (options) => {
        if (!options) {
          throw new Error('TypeORM options are required');
        }
        const dataSource = new DataSource(options);
        await dataSource.initialize();
        await ensurePgVector(dataSource);
        return dataSource;
      }
    }),
    TypeOrmModule.forFeature(entities)
  ],
  exports: [TypeOrmModule]
})
export class DatabaseModule {}
