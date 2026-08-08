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
import {
  BREAKPOINTS,
  DEFAULT_QUALITY,
  RASTER_FORMATS,
  SVG_CONVERTER_VERSION
} from './constants.js';
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
  /** Serializes all reconcile/remove/ensureVariant work per relativePath — a watcher
   * event and an in-flight HTTP request can otherwise both see "no row/variant yet"
   * and race to insert the same row, tripping a UNIQUE constraint. */
  private readonly inFlightReconciles = new Map<string, Promise<unknown>>();

  constructor(
    @InjectRepository(SourceFile)
    private readonly sourceFiles: Repository<SourceFile>,
    @InjectRepository(CacheVariant)
    private readonly variants: Repository<CacheVariant>,
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
      return [
        {
          key: 'vector',
          format: 'vector',
          width: null,
          quality: null,
          ext: 'svg'
        }
      ];
    }
    if (kind === 'svg-with-raster') {
      // SVG variants (embedded raster optimized per breakpoint)
      const svgSpecs: VariantSpec[] = BREAKPOINTS.map((width) => ({
        key: this.hasher.variantKey({ w: width, f: 'svg' }),
        format: 'svg' as const,
        width,
        quality: DEFAULT_QUALITY,
        ext: 'svg'
      }));

      // Safari fallback: flattened webp renditions (SvgService.flattenToRaster)
      // Only webp, not avif — Safari supports webp, and generating both would
      // double the variant count for marginal benefit.
      //
      // The `q` component is load-bearing: ensureVariant looks these up by
      // variantKey({ w, f, q }), so precomputing them without it files them under a
      // key nothing ever reads. Every Safari request then missed a cache that did in
      // fact hold the bytes, and regenerated them synchronously — seconds per
      // breakpoint on a first page load, long enough for the browser to drop the
      // request entirely.
      const safariSpecs: VariantSpec[] = BREAKPOINTS.map((width) => ({
        key: this.hasher.variantKey({
          w: width,
          f: 'webp',
          q: DEFAULT_QUALITY
        }),
        format: 'webp' as const,
        width,
        quality: DEFAULT_QUALITY,
        ext: 'webp'
      }));

      return [...svgSpecs, ...safariSpecs];
    }
    const specs: VariantSpec[] = [];
    for (const width of BREAKPOINTS) {
      for (const format of RASTER_FORMATS) {
        specs.push({
          key: this.hasher.variantKey({
            w: width,
            f: format,
            q: DEFAULT_QUALITY
          }),
          format,
          width,
          quality: DEFAULT_QUALITY,
          ext: format
        });
      }
    }
    return specs;
  }

  /**
   * Stat + hash inputs for a source, folding in its optional raster master.
   *
   * The stat pair stays a cheap "has anything changed" shortcut for skipping the
   * rehash: summing both sizes and taking the newer mtime is sufficient, because
   * adding, replacing or deleting a master always moves at least one of the two.
   */
  private async sourceFingerprint(fullSourcePath: string): Promise<{
    size: number;
    mtimeMs: number;
    hashInputs: string[];
  }> {
    const stat = await this.hasher.stat(fullSourcePath);
    const master =
      path.extname(fullSourcePath).toLowerCase() === '.svg'
        ? await this.svg.findMaster(fullSourcePath)
        : null;
    if (!master) return { ...stat, hashInputs: [fullSourcePath] };

    const masterStat = await this.hasher.stat(master);
    return {
      size: stat.size + masterStat.size,
      mtimeMs: Math.max(stat.mtimeMs, masterStat.mtimeMs),
      hashInputs: [fullSourcePath, master]
    };
  }

  private async classifyAndDescribe(absolutePath: string, ext: string) {
    if (ext === '.svg') {
      const content = await this.svg.read(absolutePath);
      const kind: SourceFileKind = this.svg.classify(content);
      const intrinsic = this.svg.getIntrinsicSize(content);
      const lqip =
        kind === 'svg-with-raster' ? await this.svg.generateLqip(content) : '';
      // Sample brightness off the master when there is one: same pixels the client
      // actually sees on the Safari path, and it avoids a full librsvg decode of the
      // SVG (seconds) just to produce 32 averaged rows.
      const master = await this.svg.findMaster(absolutePath);
      const contrastProfile = await this.optimizer.computeBrightnessProfile(
        master ?? absolutePath
      );
      return { kind, intrinsic, lqip, contrastProfile };
    }
    const contrastProfile =
      await this.optimizer.computeBrightnessProfile(absolutePath);
    const intrinsic = await this.optimizer.getIntrinsicSize(absolutePath);
    const lqip = await this.optimizer.generateRasterLqip(absolutePath);
    return {
      kind: 'raster' as SourceFileKind,
      intrinsic,
      lqip,
      contrastProfile
    };
  }

  private async writeVariantFile(
    fullSourcePath: string,
    spec: VariantSpec
  ): Promise<Buffer> {
    if (spec.format === 'vector') {
      const content = await this.svg.read(fullSourcePath);
      return Buffer.from(this.svg.minifyVector(content), 'utf-8');
    }
    if (spec.format === 'svg') {
      const content = await this.svg.read(fullSourcePath);
      const optimized = await this.svg.optimizeEmbeddedRasters(
        content,
        spec.width!,
        spec.quality ?? DEFAULT_QUALITY
      );
      return Buffer.from(optimized, 'utf-8');
    }
    // svg-with-raster explicitly requested as webp/avif (Safari fallback — see
    // SvgService.flattenToRaster).
    const isSvgSource = path.extname(fullSourcePath).toLowerCase() === '.svg';
    if (isSvgSource && (spec.format === 'webp' || spec.format === 'avif')) {
      // Preferred path: a pre-rendered raster master was placed next to the source
      // (see RASTER_MASTER_SUFFIX), so this is a plain downscale — milliseconds, and
      // with text rendered wherever the master was made rather than by the server's
      // fontconfig. Falls through to server-side rasterization only when absent.
      const master = await this.svg.findMaster(fullSourcePath);
      if (master) {
        const result = await this.optimizer.optimizeRaster(master, {
          width: spec.width ?? undefined,
          format: spec.format,
          quality: spec.quality ?? DEFAULT_QUALITY,
          // Same effort flattenToRaster settles on, for the same reason: these
          // renditions are enormous (3840x9333 for 1-1.svg) and effort 6 costs 59s
          // against 4.7s here for ~3% off the file size. The default 6 stays right
          // for ordinary photo sources, which are an order of magnitude smaller.
          effort: 4
        });
        return result.buffer;
      }
      // No master: rasterize the SVG here. Costs seconds per variant on a cache
      // miss, so this is the fallback, not the intent — run the masters script.
      const content = await this.svg.read(fullSourcePath);
      const intrinsic = this.svg.getIntrinsicSize(content);
      return this.svg.flattenToRaster(
        content,
        intrinsic,
        spec.width ?? BREAKPOINTS[0],
        spec.quality ?? DEFAULT_QUALITY,
        spec.format
      );
    }
    const result = await this.optimizer.optimizeRaster(fullSourcePath, {
      width: spec.width ?? undefined,
      format: spec.format as 'webp' | 'avif' | 'png' | 'jpeg',
      quality: spec.quality ?? DEFAULT_QUALITY
    });
    return result.buffer;
  }

  /** Cache files for a source live under a subfolder named after its relativePath,
   * so the whole subfolder can be torn down in one shot when the source is removed. */
  private variantDir(relativePath: string): string {
    return path.join(this.cacheFilesDir, relativePath);
  }

  private async generateVariant(
    sourceFile: SourceFile,
    fullSourcePath: string,
    spec: VariantSpec,
    existingId?: string
  ): Promise<CacheVariant> {
    const buffer = await this.writeVariantFile(fullSourcePath, spec);
    const safeKey = spec.key.replace(/[^a-z0-9]+/gi, '_');
    const baseFilename = `${sourceFile.contentHash}_${safeKey}.${spec.ext}`;
    const dir = this.variantDir(sourceFile.relativePath);
    const filename = path.join(sourceFile.relativePath, baseFilename);

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, baseFilename), buffer);
    this.logger.log(
      `Wrote variant '${spec.key}' (${spec.format}${spec.width ? `, w${spec.width}` : ''}, ${buffer.length}B) for ${sourceFile.relativePath}`
    );

    // Determine converter version: only SVG→PNG Safari fallbacks use the versioned converter
    const isSvgToRaster =
      sourceFile.kind === 'svg-with-raster' &&
      (spec.format === 'webp' || spec.format === 'avif');
    const converterVersion = isSvgToRaster ? SVG_CONVERTER_VERSION : 1;

    if (existingId) {
      await this.variants.update(existingId, {
        filename,
        sizeBytes: buffer.length,
        sourceContentHash: sourceFile.contentHash,
        converterVersion
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
      sizeBytes: buffer.length,
      converterVersion
    });
    return this.variants.save(variant);
  }

  private async generateAllVariants(
    sourceFile: SourceFile,
    fullSourcePath: string
  ): Promise<void> {
    const specs = this.expectedVariantSpecs(sourceFile.kind);
    this.logger.log(
      `Generating ${specs.length} variant(s) for ${sourceFile.relativePath} (${sourceFile.kind})`
    );
    for (const spec of specs) {
      await this.generateVariant(sourceFile, fullSourcePath, spec);
    }
  }

  /** Deletes cache files + DB rows for every variant of a source file, tearing down
   * its whole cache subfolder rather than unlinking filenames one by one. */
  private async purgeVariants(sourceFile: SourceFile): Promise<void> {
    this.logger.log(`Purging cache for ${sourceFile.relativePath}`);
    await this.variants.delete({ sourceFileId: sourceFile.id });
    await fs.rm(this.variantDir(sourceFile.relativePath), {
      recursive: true,
      force: true
    });
  }

  /** Runs `fn` for `relativePath` after any in-flight reconcile/remove/ensureVariant
   * call for the same path has settled, and queues later callers behind this one. */
  private async withFileLock<T>(
    relativePath: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const previous =
      this.inFlightReconciles.get(relativePath) ?? Promise.resolve();
    const run = previous.then(fn, fn).finally(() => {
      if (this.inFlightReconciles.get(relativePath) === run) {
        this.inFlightReconciles.delete(relativePath);
      }
    });
    this.inFlightReconciles.set(relativePath, run);
    return run;
  }

  /**
   * Core reconciliation entry point. Idempotent — safe to call repeatedly for the
   * same file (startup warmup, periodic sweep, post-change watcher events, and
   * request-time ensureVariant() lookups all funnel through here). Concurrent calls
   * for the same relativePath are serialized to avoid racing on the same DB row.
   */
  async reconcileSourceFile(relativePath: string): Promise<void> {
    return this.withFileLock(relativePath, () =>
      this.doReconcileSourceFile(relativePath)
    );
  }

  private async doReconcileSourceFile(relativePath: string): Promise<void> {
    // A raster master is an input to its .svg, never a source file of its own —
    // indexing it would give it a full variant set nothing ever requests.
    if (this.svg.isMasterPath(relativePath)) {
      this.logger.debug(`Skipping raster master as a source: ${relativePath}`);
      return;
    }

    const fullSourcePath = this.fullPath(relativePath);
    let stat: { size: number; mtimeMs: number; hashInputs: string[] };
    try {
      stat = await this.sourceFingerprint(fullSourcePath);
    } catch {
      this.logger.warn(`Reconcile skipped, file vanished: ${relativePath}`);
      return; // file vanished between the fs event and this call
    }

    this.logger.log(`Reconciling ${relativePath}`);
    const ext = path.extname(relativePath).toLowerCase();
    const row = await this.sourceFiles.findOne({ where: { relativePath } });

    const hash =
      row && row.size === stat.size && row.mtimeMs === stat.mtimeMs
        ? row.contentHash
        : await this.hasher.hashFiles(stat.hashInputs);

    if (!row) {
      const { kind, intrinsic, lqip, contrastProfile } =
        await this.classifyAndDescribe(fullSourcePath, ext);
      const created = await this.sourceFiles.save(
        this.sourceFiles.create({
          relativePath,
          contentHash: hash,
          size: stat.size,
          mtimeMs: stat.mtimeMs,
          kind,
          width: intrinsic.w,
          height: intrinsic.h,
          lqip,
          contrastProfile
        })
      );
      this.logger.log(`Indexed new file: ${relativePath} (${kind})`);
      await this.generateAllVariants(created, fullSourcePath);
      return;
    }

    if (hash !== row.contentHash) {
      // "если файл отличается от хешсумы то пересоздаём" — full invalidation + regen.
      this.logger.log(`Content changed, invalidating cache: ${relativePath}`);
      await this.purgeVariants(row);
      const { kind, intrinsic, lqip, contrastProfile } =
        await this.classifyAndDescribe(fullSourcePath, ext);
      row.contentHash = hash;
      row.size = stat.size;
      row.mtimeMs = stat.mtimeMs;
      row.kind = kind;
      row.width = intrinsic.w;
      row.height = intrinsic.h;
      row.lqip = lqip;
      row.contrastProfile = contrastProfile;
      await this.sourceFiles.save(row);
      await this.generateAllVariants(row, fullSourcePath);
      return;
    }

    // Backfills contrastProfile for rows indexed before it existed — the hash-match
    // branch below only patches missing cache *files*, not metadata, so a row whose
    // content never changed again would otherwise keep this null forever.
    if (row.contrastProfile == null) {
      row.contrastProfile =
        await this.optimizer.computeBrightnessProfile(fullSourcePath);
      await this.sourceFiles.save(row);
    }

    // Hash matches what's on record — patch missing files OR outdated converter versions.
    // SVG→PNG Safari fallback variants get auto-regenerated when SVG_CONVERTER_VERSION increases.
    const specs = this.expectedVariantSpecs(row.kind);
    const existing = await this.variants.find({
      where: { sourceFileId: row.id }
    });
    const existingByKey = new Map(existing.map((v) => [v.variantKey, v]));

    let restored = 0;
    for (const spec of specs) {
      const existingRow = existingByKey.get(spec.key);
      if (existingRow) {
        const onDisk = await fileExists(
          path.join(this.cacheFilesDir, existingRow.filename)
        );

        // Check if this is an outdated SVG→raster Safari fallback
        const isSvgToRaster =
          row.kind === 'svg-with-raster' &&
          (spec.format === 'webp' || spec.format === 'avif');
        const isOutdated =
          isSvgToRaster &&
          (existingRow.converterVersion || 1) < SVG_CONVERTER_VERSION;

        // Debug logging for SVG conversion version checks
        if (isSvgToRaster) {
          this.logger.debug(
            `[SVG Converter] ${relativePath} variant '${spec.key}': ` +
              `version=${existingRow.converterVersion || 1}, target=${SVG_CONVERTER_VERSION}, ` +
              `outdated=${isOutdated}, onDisk=${onDisk}`
          );
        }

        if (onDisk && !isOutdated) continue;

        if (isOutdated) {
          this.logger.log(
            `Regenerating '${spec.key}' for ${relativePath} (converter v${existingRow.converterVersion || 1} → v${SVG_CONVERTER_VERSION})`
          );
        }

        await this.generateVariant(row, fullSourcePath, spec, existingRow.id);
        restored++;
        if (!isOutdated) {
          this.logger.log(
            `Restored missing cache variant '${spec.key}' for ${relativePath}`
          );
        }
      } else {
        await this.generateVariant(row, fullSourcePath, spec);
        restored++;
      }
    }

    const pruned = await this.pruneShadowedVariants(row, specs, existing);

    if (restored === 0 && pruned === 0) {
      this.logger.log(
        `Unchanged, all ${specs.length} variant(s) already cached: ${relativePath}`
      );
    }
  }

  /**
   * Drops variants that cover the same format+width as an expected spec but sit under
   * a different variantKey — the residue of a change to how keys are composed. The
   * generation loop above only ever fills gaps, so without this the superseded rows
   * (and their files) would survive every future sweep, unreadable and never evicted.
   *
   * Matching on format+width rather than "anything unexpected" is deliberate:
   * ensureVariant legitimately creates variants for custom widths outside BREAKPOINTS,
   * and those must survive a sweep instead of being deleted and regenerated in a loop.
   */
  private async pruneShadowedVariants(
    row: SourceFile,
    specs: VariantSpec[],
    existing: CacheVariant[]
  ): Promise<number> {
    const expectedKeys = new Set(specs.map((s) => s.key));
    const expectedSlots = new Set(specs.map((s) => `${s.format}@${s.width}`));

    let pruned = 0;
    for (const variant of existing) {
      if (expectedKeys.has(variant.variantKey)) continue;
      if (!expectedSlots.has(`${variant.format}@${variant.width}`)) continue;

      this.logger.log(
        `Pruning superseded variant '${variant.variantKey}' for ${row.relativePath}`
      );
      await this.variants.delete(variant.id);
      await fs.rm(path.join(this.cacheFilesDir, variant.filename), {
        force: true
      });
      pruned++;
    }
    return pruned;
  }

  async removeSourceFile(relativePath: string): Promise<void> {
    return this.withFileLock(relativePath, async () => {
      const row = await this.sourceFiles.findOne({ where: { relativePath } });
      if (!row) return;
      await this.purgeVariants(row);
      await this.sourceFiles.delete({ id: row.id });
      this.logger.log(`Removed from index: ${relativePath}`);
    });
  }

  /** Re-checks every known source file (catches out-of-band cache-file deletions with
   * no fs event), then prunes any cache dir left behind by a source file that's gone.
   * Files are processed in batches with progress logging. */
  async reconcileAll(): Promise<void> {
    const rows = await this.sourceFiles.find();
    const total = rows.length;

    if (total === 0) {
      this.logger.log('No files to reconcile');
      return;
    }

    // Log SVG→raster converter status before reconciliation
    const svgWithRaster = rows.filter((r) => r.kind === 'svg-with-raster');
    if (svgWithRaster.length > 0) {
      this.logger.log(
        `Found ${svgWithRaster.length} svg-with-raster file(s) that may need converter v${SVG_CONVERTER_VERSION} regeneration`
      );
      for (const sf of svgWithRaster) {
        const variants = await this.variants.find({
          where: { sourceFileId: sf.id }
        });
        const webpAvif = variants.filter(
          (v) => v.format === 'webp' || v.format === 'avif'
        );
        const outdated = webpAvif.filter(
          (v) => (v.converterVersion || 1) < SVG_CONVERTER_VERSION
        );
        if (outdated.length > 0) {
          this.logger.log(
            `  ${sf.relativePath}: ${outdated.length}/${webpAvif.length} variant(s) outdated (v${outdated[0].converterVersion || 1} < v${SVG_CONVERTER_VERSION})`
          );
        }
      }
    }

    this.logger.log(`Starting batch reconciliation of ${total} file(s)`);

    const BATCH_SIZE = 10;
    let processed = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, Math.min(i + BATCH_SIZE, rows.length));

      // Process batch sequentially to avoid overwhelming the system
      for (const row of batch) {
        await this.reconcileSourceFile(row.relativePath);
        processed++;
      }

      const percentDone = Math.round((processed / total) * 100);
      this.logger.log(
        `Reconciliation progress: ${processed}/${total} (${percentDone}%)`
      );
    }

    this.logger.log(
      `Batch reconciliation complete: ${total} file(s) processed`
    );
    await this.pruneOrphanedCacheDirs();
  }

  /** Recursively finds cache-file leaf directories — the per-source subfolders
   * created by variantDir(), one level deeper than intermediate path segments. */
  private async listLeafCacheDirs(dir: string): Promise<string[]> {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }
    const subdirs = entries.filter((e) => e.isDirectory());
    if (subdirs.length === 0) {
      return dir === this.cacheFilesDir ? [] : [dir];
    }
    const leaves: string[] = [];
    for (const sub of subdirs) {
      leaves.push(...(await this.listLeafCacheDirs(path.join(dir, sub.name))));
    }
    return leaves;
  }

  /**
   * Removes cache subfolders that don't correspond to any known source file — e.g. a
   * file renamed/deleted while the server (and its fs watcher) wasn't running, so no
   * `unlink` event ever fired to trigger removeSourceFile's cleanup.
   */
  private async pruneOrphanedCacheDirs(): Promise<void> {
    const known = new Set(
      (await this.sourceFiles.find()).map((r) => r.relativePath)
    );
    const leaves = await this.listLeafCacheDirs(this.cacheFilesDir);
    for (const dir of leaves) {
      const relativePath = path.relative(this.cacheFilesDir, dir);
      if (!known.has(relativePath)) {
        this.logger.log(
          `Pruning orphaned cache dir (no matching source file): ${relativePath}`
        );
        await fs.rm(dir, { recursive: true, force: true });
      }
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
        intrinsic: { w: row.width, h: row.height },
        contentHash: row.contentHash,
        contrastProfile: row.contrastProfile ?? []
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
    request: {
      width?: number;
      format?: 'webp' | 'avif' | 'png' | 'jpeg';
      quality?: number;
    }
  ): Promise<ResolvedVariant> {
    const fullSourcePath = this.fullPath(relativePath);
    await fs.access(fullSourcePath);

    // Shares the same per-path lock as reconcileSourceFile/removeSourceFile, so a
    // request landing mid-reconcile can't race the watcher to insert the same
    // cache_variants row. Calls doReconcileSourceFile (not the public, lock-taking
    // wrapper) below to avoid deadlocking on its own lock re-entrantly.
    return this.withFileLock(relativePath, async () => {
      let row = await this.sourceFiles.findOne({ where: { relativePath } });
      if (!row) {
        await this.doReconcileSourceFile(relativePath);
        row = await this.sourceFiles.findOne({ where: { relativePath } });
        if (!row) throw new Error(`Failed to index ${relativePath}`);
      }

      const ext = path.extname(relativePath).toLowerCase();
      const isSvg = ext === '.svg';
      const isVector = isSvg && row.kind === 'svg-vector';
      // Explicit raster override for an svg-with-raster source (Safari fallback —
      // see SvgService.flattenToRaster): everything else about an .svg path still
      // defaults to serving the vector/embedded-raster shell.
      const wantsSvgFlattenedToRaster =
        isSvg &&
        row.kind === 'svg-with-raster' &&
        (request.format === 'webp' || request.format === 'avif');

      const spec: VariantSpec = isVector
        ? {
            key: 'vector',
            format: 'vector',
            width: null,
            quality: null,
            ext: 'svg'
          }
        : wantsSvgFlattenedToRaster
          ? {
              key: this.hasher.variantKey({
                w: request.width,
                f: request.format,
                q: request.quality ?? DEFAULT_QUALITY
              }),
              format: request.format!,
              width: request.width ?? BREAKPOINTS[0],
              quality: request.quality ?? DEFAULT_QUALITY,
              ext: request.format!
            }
          : isSvg
            ? {
                key: this.hasher.variantKey({ w: request.width, f: 'svg' }),
                format: 'svg',
                width: request.width ?? BREAKPOINTS[0],
                quality: request.quality ?? DEFAULT_QUALITY,
                ext: 'svg'
              }
            : {
                key: this.hasher.variantKey({
                  w: request.width,
                  f: request.format,
                  q: request.quality ?? DEFAULT_QUALITY
                }),
                format: request.format ?? 'webp',
                width: request.width ?? null,
                quality: request.quality ?? DEFAULT_QUALITY,
                ext: request.format ?? 'webp'
              };

      let variant = await this.variants.findOne({
        where: { sourceFileId: row.id, variantKey: spec.key }
      });
      if (variant) {
        const filePath = path.join(this.cacheFilesDir, variant.filename);
        if (await fileExists(filePath)) {
          this.logger.debug(`Cache hit '${spec.key}' for ${relativePath}`);
          return {
            buffer: await fs.readFile(filePath),
            mime: MIME_BY_FORMAT[variant.format],
            sourceHash: row.contentHash,
            variantKey: variant.variantKey
          };
        }
      }

      this.logger.log(
        `Cache miss '${spec.key}' for ${relativePath}, generating on request`
      );
      variant = await this.generateVariant(
        row,
        fullSourcePath,
        spec,
        variant?.id
      );
      const filePath = path.join(this.cacheFilesDir, variant.filename);
      return {
        buffer: await fs.readFile(filePath),
        mime: MIME_BY_FORMAT[variant.format],
        sourceHash: row.contentHash,
        variantKey: variant.variantKey
      };
    });
  }
}
