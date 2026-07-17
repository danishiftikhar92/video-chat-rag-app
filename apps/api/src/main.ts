import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getEnv } from './config/env';
import { AppModule } from './app.module';

async function bootstrap() {
  const env = getEnv();
  const app = await NestFactory.create(AppModule, { cors: { origin: env.CORS_ORIGIN } });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false
    })
  );

  await app.listen(Number(env.PORT));
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
