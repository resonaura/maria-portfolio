import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Repository } from 'typeorm';
import { AppConfig } from '../config.js';
import { CacheVariant } from '../database/cache-variant.entity.js';
import { SourceFile, SourceFileKind } from '../database/source-file.entity.js';
import { HasherService } from '../pipeline/hasher.service.js';
import { OptimizerService } from '../pipeline/optimizer.service.js';
import { SvgService } from '../pipeline/svg.service.js';
import { BREAKPOINTS, DEFAULT_QUALITY, RASTER_FORMATS } from './constants.js';
import { ImageManifest, ResolvedVariant, VariantSpec } from './types.js';

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

const MIME_BY_FORMAT: Record<string, string> = {
  webp: 'image/webp',
  avif: 'image/avif',
  png: 'image/png',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  vector: 'image/svg+xml'
};

/**
 * DB-backed cache reconciliation. The source_files/cache_variants tables are the
 * source of truth for "what should exist"; the .cache/files directory is a derived,
 * disposable artifact that can be partially or fully wiped and self-heals from the DB.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly storageDir: string;
  private readonly cacheFilesDir: string;

  constructor(
    @InjectRepository(SourceFile) private readonly sourceFiles: Repository<SourceFile>,
    @InjectRepository(CacheVariant) private readonly variants: Repository<CacheVariant>,
    private readonly hasher: HasherService,
    private readonly optimizer: OptimizerService,
    private readonly svg: SvgService,
    config: ConfigService<AppConfig, true>
  ) {
    this.storageDir = config.get('STORAGE_DIR', { infer: true });
    this.cacheFilesDir = config.get('cacheFilesDir', { infer: true });
  }

  private fullPath(relativePath: string): string {
    return path.join(this.storageDir, relativePath);
  }

  private expectedVariantSpecs(kind: SourceFileKind): VariantSpec[] {
    if (kind === 'svg-vector') {
      return [{ key: 'vector', format: 'vector', width: null, quality: null, ext: 'svg' }];
    }
    if (kind === 'svg-with-raster') {
      return BREAKPOINTS.map((width) => ({
        key: this.hasher.variantKey({ w: width, f: 'svg' }),
        format: 'svg',
        width,
        quality: DEFAULT_QUALITY,
        ext: 'svg'
      }));
    }
    const specs: VariantSpec[] = [];
    for (const width of BREAKPOINTS) {
      for (const format of RASTER_FORMATS) {
        specs.push({
          key: this.hasher.variantKey({ w: width, f: format, q: DEFAULT_QUALITY }),
          format,
          width,
          quality: DEFAULT_QUALITY,
          ext: format
        });
      }
    }
    return specs;
  }

  private async classifyAndDescribe(absolutePath: string, ext: string) {
    if (ext === '.svg') {
      const content = await this.svg.read(absolutePath);
      const kind: SourceFileKind = this.svg.classify(content);
      const intrinsic = this.svg.getIntrinsicSize(content);
      const lqip = kind === 'svg-with-raster' ? await this.svg.generateLqip(content) : '';
      return { kind, intrinsic, lqip };
    }
    const intrinsic = await this.optimizer.getIntrinsicSize(absolutePath);
    const lqip = await this.optimizer.generateRasterLqip(absolutePath);
    return { kind: 'raster' as SourceFileKind, intrinsic, lqip };
  }

  private async writeVariantFile(fullSourcePath: string, spec: VariantSpec): Promise<Buffer> {
    if (spec.format === 'vector') {
      const content = await this.svg.read(fullSourcePath);
      return Buffer.from(this.svg.minifyVector(content), 'utf-8');
    }
    if (spec.format === 'svg') {
      const content = await this.svg.read(fullSourcePath);
      const optimized = await this.svg.optimizeEmbeddedRasters(content, spec.width!, spec.quality ?? DEFAULT_QUALITY);
      return Buffer.from(optimized, 'utf-8');
    }
    const result = await this.optimizer.optimizeRaster(fullSourcePath, {
      width: spec.width ?? undefined,
      format: spec.format as 'webp' | 'avif' | 'png' | 'jpeg',
      quality: spec.quality ?? DEFAULT_QUALITY
    });
    return result.buffer;
  }

  private async generateVariant(
    sourceFile: SourceFile,
    fullSourcePath: string,
    spec: VariantSpec,
    existingId?: string
  ): Promise<CacheVariant> {
    const buffer = await this.writeVariantFile(fullSourcePath, spec);
    const safeKey = spec.key.replace(/[^a-z0-9]+/gi, '_');
    const filename = `${sourceFile.contentHash}_${safeKey}.${spec.ext}`;

    await fs.mkdir(this.cacheFilesDir, { recursive: true });
    await fs.writeFile(path.join(this.cacheFilesDir, filename), buffer);

    if (existingId) {
      await this.variants.update(existingId, {
        filename,
        sizeBytes: buffer.length,
        sourceContentHash: sourceFile.contentHash
      });
      return (await this.variants.findOneBy({ id: existingId }))!;
    }

    const variant = this.variants.create({
      sourceFileId: sourceFile.id,
      sourceContentHash: sourceFile.contentHash,
      variantKey: spec.key,
      format: spec.format,
      width: spec.width,
      quality: spec.quality,
      filename,
      sizeBytes: buffer.length
    });
    return this.variants.save(variant);
  }

  private async generateAllVariants(sourceFile: SourceFile, fullSourcePath: string): Promise<void> {
    const specs = this.expectedVariantSpecs(sourceFile.kind);
    for (const spec of specs) {
      await this.generateVariant(sourceFile, fullSourcePath, spec);
    }
  }

  /** Deletes cache files + DB rows for every variant of a source file. */
  private async purgeVariants(sourceFileId: string): Promise<void> {
    const existing = await this.variants.find({ where: { sourceFileId } });
    await Promise.all(existing.map((v) => fs.rm(path.join(this.cacheFilesDir, v.filename), { force: true })));
    if (existing.length > 0) {
      await this.variants.delete({ sourceFileId });
    }
  }

  /**
   * Core reconciliation entry point. Idempotent — safe to call repeatedly for the
   * same file (startup warmup, periodic sweep, and post-change watcher events all
   * funnel through here).
   */
  async reconcileSourceFile(relativePath: string): Promise<void> {
    const fullSourcePath = this.fullPath(relativePath);
    let stat: { size: number; mtimeMs: number };
    try {
      stat = await this.hasher.stat(fullSourcePath);
    } catch {
      return; // file vanished between the fs event and this call
    }

    const ext = path.extname(relativePath).toLowerCase();
    const row = await this.sourceFiles.findOne({ where: { relativePath } });

    const hash =
      row && row.size === stat.size && row.mtimeMs === stat.mtimeMs
        ? row.contentHash
        : await this.hasher.hashContent(fullSourcePath);

    if (!row) {
      const { kind, intrinsic, lqip } = await this.classifyAndDescribe(fullSourcePath, ext);
      const created = await this.sourceFiles.save(
        this.sourceFiles.create({
          relativePath,
          contentHash: hash,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
          kind,
          width: intrinsic.w,
          height: intrinsic.h,
          lqip
        })
      );
      this.logger.log(`Indexed new file: ${relativePath} (${kind})`);
      await this.generateAllVariants(created, fullSourcePath);
      return;
    }

    if (hash !== row.contentHash) {
      // "если файл отличается от хешсумы то пересоздаём" — full invalidation + regen.
      this.logger.log(`Content changed, invalidating cache: ${relativePath}`);
      await this.purgeVariants(row.id);
      const { kind, intrinsic, lqip } = await this.classifyAndDescribe(fullSourcePath, ext);
      row.contentHash = hash;
      row.size = stat.size;
      row.mtimeMs = stat.mtimeMs;
      row.kind = kind;
      row.width = intrinsic.w;
      row.height = intrinsic.h;
      row.lqip = lqip;
      await this.sourceFiles.save(row);
      await this.generateAllVariants(row, fullSourcePath);
      return;
    }

    // Hash matches what's on record — only patch what's actually missing on disk.
    // "если файла в кеше нет какого-то одного... восстанавливаем ток его"
    const specs = this.expectedVariantSpecs(row.kind);
    const existing = await this.variants.find({ where: { sourceFileId: row.id } });
    const existingByKey = new Map(existing.map((v) => [v.variantKey, v]));

    for (const spec of specs) {
      const existingRow = existingByKey.get(spec.key);
      if (existingRow) {
        const onDisk = await fileExists(path.join(this.cacheFilesDir, existingRow.filename));
        if (onDisk) continue;
        await this.generateVariant(row, fullSourcePath, spec, existingRow.id);
        this.logger.log(`Restored missing cache variant '${spec.key}' for ${relativePath}`);
      } else {
        await this.generateVariant(row, fullSourcePath, spec);
      }
    }
  }

  async removeSourceFile(relativePath: string): Promise<void> {
    const row = await this.sourceFiles.findOne({ where: { relativePath } });
    if (!row) return;
    await this.purgeVariants(row.id);
    await this.sourceFiles.delete({ id: row.id });
    this.logger.log(`Removed from index: ${relativePath}`);
  }

  /** Re-checks every known source file. Catches out-of-band cache-file deletions with no fs event. */
  async reconcileAll(): Promise<void> {
    const rows = await this.sourceFiles.find();
    for (const row of rows) {
      await this.reconcileSourceFile(row.relativePath);
    }
  }

  async getManifest(): Promise<ImageManifest> {
    const rows = await this.sourceFiles.find();
    const manifest: ImageManifest = {};
    for (const row of rows) {
      manifest[row.relativePath] = {
        lqip: row.lqip,
        breakpoints: row.kind === 'svg-vector' ? [] : [...BREAKPOINTS],
        type: row.kind,
        intrinsic: { w: row.width, h: row.height }
      };
    }
    return manifest;
  }

  /**
   * Request-time resolution used by ImagesController. Serves an existing cache hit,
   * self-heals a DB row whose file went missing, or generates + indexes a brand-new
   * variant (e.g. a custom width outside the precomputed breakpoint set).
   */
  async ensureVariant(
    relativePath: string,
    request: { width?: number; format?: 'webp' | 'avif' | 'png' | 'jpeg'; quality?: number }
  ): Promise<ResolvedVariant> {
    const fullSourcePath = this.fullPath(relativePath);
    await fs.access(fullSourcePath);

    let row = await this.sourceFiles.findOne({ where: { relativePath } });
    if (!row) {
      await this.reconcileSourceFile(relativePath);
      row = await this.sourceFiles.findOne({ where: { relativePath } });
      if (!row) throw new Error(`Failed to index ${relativePath}`);
    }

    const ext = path.extname(relativePath).toLowerCase();
    const isSvg = ext === '.svg';
    const isVector = isSvg && row.kind === 'svg-vector';

    const spec: VariantSpec = isVector
      ? { key: 'vector', format: 'vector', width: null, quality: null, ext: 'svg' }
      : isSvg
        ? {
            key: this.hasher.variantKey({ w: request.width, f: 'svg' }),
            format: 'svg',
            width: request.width ?? BREAKPOINTS[0],
            quality: request.quality ?? DEFAULT_QUALITY,
            ext: 'svg'
          }
        : {
            key: this.hasher.variantKey({ w: request.width, f: request.format, q: request.quality ?? DEFAULT_QUALITY }),
            format: request.format ?? 'webp',
            width: request.width ?? null,
            quality: request.quality ?? DEFAULT_QUALITY,
            ext: request.format ?? 'webp'
          };

    let variant = await this.variants.findOne({ where: { sourceFileId: row.id, variantKey: spec.key } });
    if (variant) {
      const filePath = path.join(this.cacheFilesDir, variant.filename);
      if (await fileExists(filePath)) {
        return {
          buffer: await fs.readFile(filePath),
          mime: MIME_BY_FORMAT[variant.format],
          sourceHash: row.contentHash,
          variantKey: variant.variantKey
        };
      }
    }

    variant = await this.generateVariant(row, fullSourcePath, spec, variant?.id);
    const filePath = path.join(this.cacheFilesDir, variant.filename);
    return {
      buffer: await fs.readFile(filePath),
      mime: MIME_BY_FORMAT[variant.format],
      sourceHash: row.contentHash,
      variantKey: variant.variantKey
    };
  }
}
