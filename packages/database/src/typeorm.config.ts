import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { entities } from './data-source';

export const createTypeOrmConfig = (databaseUrl: string, synchronize = false): TypeOrmModuleOptions => ({
  type: 'postgres',
  url: databaseUrl,
  entities,
  synchronize,
  logging: process.env.NODE_ENV === 'development',
  autoLoadEntities: false
});
