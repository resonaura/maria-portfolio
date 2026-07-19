import { Controller, Get, Logger, Param, Query, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply, FastifyRequest } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import { AppConfig } from '../config.js';
import { CacheService } from '../cache/cache.service.js';

@Controller('img')
export class ImagesController {
  private readonly logger = new Logger(ImagesController.name);
  private readonly storageDir: string;

  constructor(
    private readonly cache: CacheService,
    config: ConfigService<AppConfig, true>
  ) {
    this.storageDir = config.get('STORAGE_DIR', { infer: true });
  }

  @Get('*')
  async getImage(
    @Param('*') wildcard: string,
    @Query() query: Record<string, string>,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply
  ): Promise<void> {
    const relativePath = wildcard;
    if (!relativePath) {
      reply.code(400).send({ error: 'Missing image path' });
      return;
    }

    const resolvedPath = path.resolve(this.storageDir, relativePath);
    const storageRoot = this.storageDir.endsWith(path.sep) ? this.storageDir : this.storageDir + path.sep;
    if (!resolvedPath.startsWith(storageRoot)) {
      reply.code(403).send({ error: 'Access denied' });
      return;
    }

    try {
      await fs.access(resolvedPath);
    } catch {
      reply.code(404).send({ error: 'Image not found' });
      return;
    }

    const width = query.w ? Math.round(parseInt(query.w, 10) * (query.dpr ? parseFloat(query.dpr) : 1)) : undefined;
    const quality = query.q ? parseInt(query.q, 10) : undefined;
    const format = this.resolveFormat(resolvedPath, query.format, request.headers.accept);

    try {
      const result = await this.cache.ensureVariant(relativePath, {
        width,
        format: format === 'svg' ? undefined : format,
        quality
      });

      reply
        .header('Content-Type', result.mime)
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .header('ETag', `W/"${result.sourceHash}-${result.variantKey}"`)
        .header('Vary', 'Accept')
        .send(result.buffer);
    } catch (error) {
      this.logger.error(`Failed to resolve variant for ${relativePath}: ${(error as Error).message}`);
      reply.code(500).send({ error: 'Optimization failed' });
    }
  }

  private resolveFormat(
    resolvedPath: string,
    queryFormat: string | undefined,
    accept: string | undefined
  ): 'webp' | 'avif' | 'png' | 'jpeg' | 'svg' {
    if (path.extname(resolvedPath).toLowerCase() === '.svg') {
      // Explicit raster override (Safari fallback for svg-with-raster sources —
      // see SvgService.flattenToRaster): opt-in only, via an explicit query param.
      // Accept-header negotiation is intentionally not consulted here — clients
      // that want the vector/embedded-raster shell (the default, and the only
      // thing that exists for svg-vector sources) still get exactly that.
      if (queryFormat === 'webp' || queryFormat === 'avif') return queryFormat;
      return 'svg';
    }
    if (queryFormat === 'avif' || queryFormat === 'webp' || queryFormat === 'png' || queryFormat === 'jpeg') {
      return queryFormat;
    }
    if (accept?.includes('image/avif')) return 'avif';
    if (accept?.includes('image/webp')) return 'webp';
    return 'webp';
  }
}
