import compress from '@fastify/compress';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication
} from '@nestjs/platform-fastify';
import 'reflect-metadata';
import { AppModule } from './app.module.js';
import { AppConfig } from './config.js';

async function bootstrap() {
  // Configure Fastify logger to output to stdout for PM2 compatibility
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: {
        level: 'info',
        stream: process.stdout
      }
    })
  );

  const config = app.get(ConfigService<AppConfig, true>);

  app.enableCors({
    origin: config.get('CORS_ORIGIN', { infer: true }),
    methods: ['GET'],
    allowedHeaders: ['Content-Type']
  });

  await app.register(compress, {
    threshold: 1024,
    encodings: ['gzip', 'deflate', 'br']
  });

  const port = config.get('PORT', { infer: true });
  const host = config.get('HOST', { infer: true });
  await app.listen(port, host);
  // eslint-disable-next-line no-console
  console.log(
    `[Server] Image Optimization Engine running at http://${host}:${port}`
  );
}

bootstrap();
