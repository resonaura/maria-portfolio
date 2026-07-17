import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import fs from 'node:fs';
import path from 'node:path';
import { validateEnv } from './config.js';
import { CacheVariant } from './database/cache-variant.entity.js';
import { SourceFile } from './database/source-file.entity.js';
import { CacheModule } from './cache/cache.module.js';
import { ImagesModule } from './images/images.module.js';
import { ManifestModule } from './manifest/manifest.module.js';
import { WatcherModule } from './watcher/watcher.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const config = validateEnv(process.env);
        fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
        return {
          type: 'better-sqlite3' as const,
          database: config.dbPath,
          entities: [SourceFile, CacheVariant],
          synchronize: true
        };
      }
    }),
    CacheModule,
    WatcherModule,
    ImagesModule,
    ManifestModule
  ]
})
export class AppModule {}
