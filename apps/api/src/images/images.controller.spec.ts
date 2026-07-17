import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CacheVariant } from '../database/cache-variant.entity.js';
import { SourceFile } from '../database/source-file.entity.js';
import { HasherService } from '../pipeline/hasher.service.js';
import { OptimizerService } from '../pipeline/optimizer.service.js';
import { SvgService } from '../pipeline/svg.service.js';
import { CacheService } from '../cache/cache.service.js';
import { ImagesController } from './images.controller.js';

describe('ImagesController (e2e via Fastify inject)', () => {
  let app: NestFastifyApplication;
  let storageDir: string;

  beforeEach(async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'images-controller-test-'));
    storageDir = path.join(root, 'storage');
    const cacheFilesDir = path.join(root, '.cache', 'files');
    await fs.mkdir(storageDir, { recursive: true });

    const buffer = await sharp({
      create: { width: 16, height: 16, channels: 3, background: { r: 10, g: 120, b: 200 } }
    })
      .png()
      .toBuffer();
    await fs.writeFile(path.join(storageDir, 'photo.png'), buffer);

    const fakeConfig: Partial<ConfigService> = {
      get: (key: string) => {
        if (key === 'STORAGE_DIR') return storageDir;
        if (key === 'cacheFilesDir') return cacheFilesDir;
        return undefined;
      }
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [SourceFile, CacheVariant],
          synchronize: true
        }),
        TypeOrmModule.forFeature([SourceFile, CacheVariant])
      ],
      controllers: [ImagesController],
      providers: [
        CacheService,
        HasherService,
        OptimizerService,
        SvgService,
        { provide: ConfigService, useValue: fakeConfig }
      ]
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterEach(async () => {
    await app.close();
    await fs.rm(path.dirname(storageDir), { recursive: true, force: true });
  });

  it('generates and serves a variant on cache miss (200, correct content-type)', async () => {
    const res = await app.inject({ method: 'GET', url: '/img/photo.png?w=320&format=webp' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/webp');
    expect(res.rawPayload.length).toBeGreaterThan(0);
  });

  it('serves the same bytes from cache on a second request (cache hit)', async () => {
    const first = await app.inject({ method: 'GET', url: '/img/photo.png?w=320&format=webp' });
    const second = await app.inject({ method: 'GET', url: '/img/photo.png?w=320&format=webp' });
    expect(second.statusCode).toBe(200);
    expect(second.rawPayload.equals(first.rawPayload)).toBe(true);
  });

  it('returns 404 for a missing file', async () => {
    const res = await app.inject({ method: 'GET', url: '/img/does-not-exist.png' });
    expect(res.statusCode).toBe(404);
  });

  it('rejects path traversal attempts outside storage/', async () => {
    const res = await app.inject({ method: 'GET', url: '/img/..%2F..%2Fpackage.json' });
    expect([403, 404]).toContain(res.statusCode);
  });
});
