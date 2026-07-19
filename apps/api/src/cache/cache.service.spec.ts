import { ConfigService } from '@nestjs/config';
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
import { CacheService } from './cache.service.js';

const BREAKPOINTS_COUNT = 7;
const RASTER_FORMATS_COUNT = 2;
const EXPECTED_RASTER_VARIANTS = BREAKPOINTS_COUNT * RASTER_FORMATS_COUNT;

describe('CacheService reconciliation', () => {
  let storageDir: string;
  let cacheFilesDir: string;
  let cacheService: CacheService;
  let variantRepo: import('typeorm').Repository<CacheVariant>;
  let sourceRepo: import('typeorm').Repository<SourceFile>;
  let moduleRef: import('@nestjs/testing').TestingModule;

  beforeEach(async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cache-service-test-'));
    storageDir = path.join(root, 'storage');
    cacheFilesDir = path.join(root, '.cache', 'files');
    await fs.mkdir(storageDir, { recursive: true });

    const fakeConfig: Partial<ConfigService> = {
      get: (key: string) => {
        if (key === 'STORAGE_DIR') return storageDir;
        if (key === 'cacheFilesDir') return cacheFilesDir;
        return undefined;
      }
    };

    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [SourceFile, CacheVariant],
          synchronize: true
        }),
        TypeOrmModule.forFeature([SourceFile, CacheVariant])
      ],
      providers: [
        CacheService,
        HasherService,
        OptimizerService,
        SvgService,
        { provide: ConfigService, useValue: fakeConfig }
      ]
    }).compile();

    cacheService = moduleRef.get(CacheService);
    variantRepo = moduleRef.get('CacheVariantRepository');
    sourceRepo = moduleRef.get('SourceFileRepository');
  });

  afterEach(async () => {
    await moduleRef.close();
    await fs.rm(path.dirname(storageDir), { recursive: true, force: true });
  });

  async function writeFixturePng(relativePath: string): Promise<void> {
    const buffer = await sharp({
      create: { width: 16, height: 16, channels: 3, background: { r: 10, g: 120, b: 200 } }
    })
      .png()
      .toBuffer();
    const fullPath = path.join(storageDir, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, buffer);
  }

  it('indexes a brand-new raster file and generates the full breakpoint x format variant set', async () => {
    await writeFixturePng('photo.png');

    await cacheService.reconcileSourceFile('photo.png');

    const source = await sourceRepo.findOne({ where: { relativePath: 'photo.png' } });
    expect(source).not.toBeNull();
    expect(source!.kind).toBe('raster');

    const variants = await variantRepo.find({ where: { sourceFileId: source!.id } });
    expect(variants).toHaveLength(EXPECTED_RASTER_VARIANTS);

    for (const variant of variants) {
      const exists = await fs
        .access(path.join(cacheFilesDir, variant.filename))
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    }
  });

  it('restores only the single variant whose cache file went missing, leaving the rest untouched', async () => {
    await writeFixturePng('photo.png');
    await cacheService.reconcileSourceFile('photo.png');

    const source = await sourceRepo.findOne({ where: { relativePath: 'photo.png' } });
    const variants = await variantRepo.find({ where: { sourceFileId: source!.id } });
    expect(variants).toHaveLength(EXPECTED_RASTER_VARIANTS);

    const victim = variants[0];
    const survivor = variants[1];
    const survivorPath = path.join(cacheFilesDir, survivor.filename);
    const survivorContentBefore = await fs.readFile(survivorPath);

    await fs.rm(path.join(cacheFilesDir, victim.filename));

    await cacheService.reconcileSourceFile('photo.png');

    const victimExists = await fs
      .access(path.join(cacheFilesDir, victim.filename))
      .then(() => true)
      .catch(() => false);
    expect(victimExists).toBe(true);

    const survivorContentAfter = await fs.readFile(survivorPath);
    expect(survivorContentAfter.equals(survivorContentBefore)).toBe(true);

    const variantsAfter = await variantRepo.find({ where: { sourceFileId: source!.id } });
    expect(variantsAfter).toHaveLength(EXPECTED_RASTER_VARIANTS);
  });

  it('invalidates and regenerates every variant when the file content changes', async () => {
    await writeFixturePng('photo.png');
    await cacheService.reconcileSourceFile('photo.png');

    const sourceBefore = await sourceRepo.findOne({ where: { relativePath: 'photo.png' } });
    const variantsBefore = await variantRepo.find({ where: { sourceFileId: sourceBefore!.id } });
    const oldFilenames = new Set(variantsBefore.map((v) => v.filename));

    // Change the file's actual bytes (different color => different content hash).
    const changedBuffer = await sharp({
      create: { width: 16, height: 16, channels: 3, background: { r: 250, g: 5, b: 5 } }
    })
      .png()
      .toBuffer();
    await fs.writeFile(path.join(storageDir, 'photo.png'), changedBuffer);
    // Force distinct mtime so the fast-path (size+mtime) can't short-circuit past the change.
    const future = new Date(Date.now() + 5000);
    await fs.utimes(path.join(storageDir, 'photo.png'), future, future);

    await cacheService.reconcileSourceFile('photo.png');

    const sourceAfter = await sourceRepo.findOne({ where: { relativePath: 'photo.png' } });
    expect(sourceAfter!.contentHash).not.toBe(sourceBefore!.contentHash);

    const variantsAfter = await variantRepo.find({ where: { sourceFileId: sourceAfter!.id } });
    expect(variantsAfter).toHaveLength(EXPECTED_RASTER_VARIANTS);
    for (const variant of variantsAfter) {
      expect(oldFilenames.has(variant.filename)).toBe(false);
    }

    for (const filename of oldFilenames) {
      const stillExists = await fs
        .access(path.join(cacheFilesDir, filename))
        .then(() => true)
        .catch(() => false);
      expect(stillExists).toBe(false);
    }
  });

  it('indexes a vector-only SVG with a single minified "vector" variant', async () => {
    const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>';
    await fs.writeFile(path.join(storageDir, 'icon.svg'), svgContent, 'utf-8');

    await cacheService.reconcileSourceFile('icon.svg');

    const source = await sourceRepo.findOne({ where: { relativePath: 'icon.svg' } });
    expect(source!.kind).toBe('svg-vector');

    const variants = await variantRepo.find({ where: { sourceFileId: source!.id } });
    expect(variants).toHaveLength(1);
    expect(variants[0].variantKey).toBe('vector');
  });

  it('removes source and variant rows plus cache files on removeSourceFile', async () => {
    await writeFixturePng('photo.png');
    await cacheService.reconcileSourceFile('photo.png');

    const source = await sourceRepo.findOne({ where: { relativePath: 'photo.png' } });
    const variants = await variantRepo.find({ where: { sourceFileId: source!.id } });
    expect(variants.length).toBeGreaterThan(0);

    await cacheService.removeSourceFile('photo.png');

    expect(await sourceRepo.findOne({ where: { relativePath: 'photo.png' } })).toBeNull();
    expect(await variantRepo.find({ where: { sourceFileId: source!.id } })).toHaveLength(0);

    for (const variant of variants) {
      const stillExists = await fs
        .access(path.join(cacheFilesDir, variant.filename))
        .then(() => true)
        .catch(() => false);
      expect(stillExists).toBe(false);
    }
  });

  it('nests cache files under a per-source subfolder and removes that whole folder on delete', async () => {
    await writeFixturePng('nested/photo.png');
    await cacheService.reconcileSourceFile('nested/photo.png');

    const source = await sourceRepo.findOne({ where: { relativePath: 'nested/photo.png' } });
    const variants = await variantRepo.find({ where: { sourceFileId: source!.id } });
    expect(variants.length).toBeGreaterThan(0);
    for (const variant of variants) {
      expect(variant.filename.startsWith(`nested${path.sep}photo.png${path.sep}`)).toBe(true);
    }

    const sourceDir = path.join(cacheFilesDir, 'nested', 'photo.png');
    expect(await fs.access(sourceDir).then(() => true).catch(() => false)).toBe(true);

    await cacheService.removeSourceFile('nested/photo.png');

    expect(await fs.access(sourceDir).then(() => true).catch(() => false)).toBe(false);
  });

  it('coalesces concurrent reconciles of a brand-new file instead of racing to double-insert', async () => {
    await writeFixturePng('racey.png');

    // Two callers both discover "no row yet" for the same relativePath at once —
    // this used to trip a UNIQUE(relativePath) constraint before reconciles were
    // serialized per path.
    await Promise.all([
      cacheService.reconcileSourceFile('racey.png'),
      cacheService.reconcileSourceFile('racey.png')
    ]);

    const sources = await sourceRepo.find({ where: { relativePath: 'racey.png' } });
    expect(sources).toHaveLength(1);

    const variants = await variantRepo.find({ where: { sourceFileId: sources[0].id } });
    expect(variants).toHaveLength(EXPECTED_RASTER_VARIANTS);
  });

  it('coalesces a request-time ensureVariant racing a watcher-driven reconcile of the same new file', async () => {
    await writeFixturePng('requested.png');

    // ensureVariant used to run its own generateVariant() outside the per-path lock,
    // so a page load hitting a brand-new file at the same moment the watcher was
    // reconciling it could both try to INSERT the same cache_variants row —
    // UNIQUE(sourceFileId, variantKey) constraint failure.
    const [resolved] = await Promise.all([
      cacheService.ensureVariant('requested.png', { width: 640, format: 'webp' }),
      cacheService.reconcileSourceFile('requested.png')
    ]);

    expect(resolved.buffer.length).toBeGreaterThan(0);

    const sources = await sourceRepo.find({ where: { relativePath: 'requested.png' } });
    expect(sources).toHaveLength(1);

    const variants = await variantRepo.find({ where: { sourceFileId: sources[0].id } });
    const keys = variants.map((v) => v.variantKey);
    expect(new Set(keys).size).toBe(keys.length); // no duplicate variantKey rows
  });

  it('prunes a leftover cache dir for a source file that vanished with no unlink event', async () => {
    await writeFixturePng('arts/gone.png');
    await cacheService.reconcileSourceFile('arts/gone.png');

    const orphanDir = path.join(cacheFilesDir, 'arts', 'gone.png');
    expect(await fs.access(orphanDir).then(() => true).catch(() => false)).toBe(true);

    // Simulate the file being renamed/deleted while the server (and its fs watcher)
    // wasn't running: the DB row is removed directly, without going through
    // removeSourceFile, so no cache cleanup has happened yet — mirrors a stale
    // cache dir surviving a rename that happened offline.
    const source = await sourceRepo.findOne({ where: { relativePath: 'arts/gone.png' } });
    await variantRepo.delete({ sourceFileId: source!.id });
    await sourceRepo.delete({ id: source!.id });

    expect(await fs.access(orphanDir).then(() => true).catch(() => false)).toBe(true);

    await cacheService.reconcileAll();

    expect(await fs.access(orphanDir).then(() => true).catch(() => false)).toBe(false);
  });

  it('backfills contrastProfile on an unchanged file that was indexed before that column existed', async () => {
    await writeFixturePng('arts/legacy.png');
    await cacheService.reconcileSourceFile('arts/legacy.png');

    // Simulate a row indexed before contrastProfile existed (e.g. before this
    // migration ran) — the hash-match branch doesn't otherwise revisit metadata.
    await sourceRepo.update({ relativePath: 'arts/legacy.png' }, { contrastProfile: null });
    let source = await sourceRepo.findOne({ where: { relativePath: 'arts/legacy.png' } });
    expect(source!.contrastProfile).toBeNull();

    await cacheService.reconcileSourceFile('arts/legacy.png');

    source = await sourceRepo.findOne({ where: { relativePath: 'arts/legacy.png' } });
    expect(source!.contrastProfile).not.toBeNull();
    expect(source!.contrastProfile!.length).toBeGreaterThan(0);
  });
});
