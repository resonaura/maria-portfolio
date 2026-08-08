import { Injectable, Logger } from '@nestjs/common';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { optimize, type PluginConfig } from 'svgo';
import { RASTER_MASTER_SUFFIX } from '../cache/constants.js';
import { IntrinsicSize } from './types.js';

export interface EmbeddedRaster {
  dataUri: string;
  mime: string;
  base64: string;
}

const IMAGE_TAG_RE = /<image\s+([^>]*?)>/gi;
const DATA_URI_RE =
  /(?:href|xlink:href)=["'](data:(image\/\w+);base64,([^"'\s]+))["']/i;
const VIEWBOX_RE =
  /viewBox=["']\s*([0-9.-]+)[\s,]+([0-9.-]+)[\s,]+([0-9.-]+)[\s,]+([0-9.-]+)\s*["']/i;
const WIDTH_RE = /\bwidth=["']\s*([0-9.]+)(?:px)?\s*["']/i;
const HEIGHT_RE = /\bheight=["']\s*([0-9.]+)(?:px)?\s*["']/i;

/**
 * SVG-specific pipeline: detects embedded raster images, optimizes them in place,
 * minifies/sanitizes the vector shell via SVGO, and reads intrinsic dimensions.
 */
@Injectable()
export class SvgService {
  private readonly logger = new Logger(SvgService.name);

  async read(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8');
  }

  /** Path an SVG's optional pre-rendered raster master would live at, whether or not it exists. */
  masterPath(svgPath: string): string {
    return `${svgPath}${RASTER_MASTER_SUFFIX}`;
  }

  /** True for a path that IS a master, rather than a source that may have one. */
  isMasterPath(filePath: string): boolean {
    return filePath.endsWith(RASTER_MASTER_SUFFIX);
  }

  /** The master's path if one has been placed next to `svgPath`, else null. */
  async findMaster(svgPath: string): Promise<string | null> {
    const candidate = this.masterPath(svgPath);
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      return null;
    }
  }

  findEmbeddedRasters(svgContent: string): EmbeddedRaster[] {
    const rasters: EmbeddedRaster[] = [];
    let match: RegExpExecArray | null;
    IMAGE_TAG_RE.lastIndex = 0;
    while ((match = IMAGE_TAG_RE.exec(svgContent)) !== null) {
      const uriMatch = DATA_URI_RE.exec(match[0]);
      if (uriMatch) {
        rasters.push({
          dataUri: uriMatch[1],
          mime: uriMatch[2],
          base64: uriMatch[3]
        });
      }
    }
    return rasters;
  }

  classify(svgContent: string): 'svg-vector' | 'svg-with-raster' {
    return this.findEmbeddedRasters(svgContent).length > 0
      ? 'svg-with-raster'
      : 'svg-vector';
  }

  /**
   * Downscales every embedded raster to targetWidth and rewrites the SVG shell via SVGO.
   * Uses replaceAll on the exact original data URI: if two <image> tags embed byte-identical
   * raster payloads, both must be replaced, not just the first match.
   */
  async optimizeEmbeddedRasters(
    svgContent: string,
    targetWidth: number,
    quality = 80
  ): Promise<string> {
    const rasters = this.findEmbeddedRasters(svgContent);
    let result = svgContent;

    for (const raster of rasters) {
      try {
        const buffer = Buffer.from(raster.base64, 'base64');
        const meta = await sharp(buffer).metadata();
        const origWidth = meta.width ?? targetWidth;
        const newWidth = Math.min(targetWidth, origWidth);

        const format =
          raster.mime.includes('jpeg') || raster.mime.includes('jpg')
            ? 'jpeg'
            : 'webp';
        // smartSubsample/mozjpeg spend extra encode time preserving chroma detail at
        // sharp edges (text, thin lines) instead of subsampling uniformly — that's
        // where lossy compression visibly smears text first.
        const formatOptions =
          format === 'webp'
            ? { quality, smartSubsample: true }
            : { quality, mozjpeg: true };
        const optimizedBuffer = await sharp(buffer)
          .resize({ width: newWidth, withoutEnlargement: true })
          .toFormat(format, formatOptions)
          .toBuffer();

        const newDataUri = `data:image/${format};base64,${optimizedBuffer.toString('base64')}`;
        result = result.replaceAll(raster.dataUri, newDataUri);
      } catch (error) {
        this.logger.error(
          `Failed to optimize embedded raster: ${(error as Error).message}`
        );
      }
    }

    return this.minifyVector(result);
  }

  /**
   * Structural minification + sanitization via SVGO. `preset-default` never touches
   * viewBox/width/height (neither plugin is part of the default set — confirmed
   * against SVGO's own plugin list, and SVGO itself rejects trying to override them
   * there), so intrinsic sizing stays correct with no extra config. `removeScripts`
   * and a `removeAttrs` pass for `on*` handlers are added explicitly: preset-default
   * does NOT sanitize scripts/event handlers on its own, so without these two, hostile
   * markup would survive minification unchanged.
   */
  minifyVector(svgContent: string): string {
    try {
      const plugins: PluginConfig[] = [
        {
          name: 'preset-default',
          params: {
            overrides: {
              cleanupIds: { preservePrefixes: ['ring-', 'cta-'] }
            }
          }
        },
        'removeScripts',
        { name: 'removeAttrs', params: { attrs: 'on\\w+' } }
      ];
      const result = optimize(svgContent, { multipass: true, plugins });
      return result.data;
    } catch (error) {
      this.logger.error(
        `SVGO optimization failed, serving unminified: ${(error as Error).message}`
      );
      return svgContent;
    }
  }

  async generateLqip(svgContent: string): Promise<string> {
    const optimized = await this.optimizeEmbeddedRasters(svgContent, 40, 30);
    return `data:image/svg+xml;base64,${Buffer.from(optimized, 'utf-8').toString('base64')}`;
  }

  /**
   * Flattens an svg-with-raster source straight to a webp/avif buffer in a single
   * lossy pass — for Safari, which renders the same content composited inline
   * (raster <image> inside an SVG document) through a permanently soft, backing-store
   * capped path regardless of source resolution (see useProgressiveSvg on the client).
   * A plain rasterized <img> sidesteps that entirely.
   *
   * Source SVGs here declare width="100%" height="100%" with no absolute size, so
   * sharp/librsvg has nothing to size the native decode by except viewBox units at
   * its default 72dpi — for an 18000-wide viewBox that's a ~254MP decode before any
   * resize happens. `density` is scaled down so the native decode lands close to
   * targetWidth directly, and the trailing resize only needs to correct rounding.
   *
   * V3 improvements: higher DPI + optimizeLegibility for better cross-platform text.
   */
  async flattenToRaster(
    svgContent: string,
    intrinsic: IntrinsicSize,
    targetWidth: number,
    quality: number,
    format: 'webp' | 'avif'
  ): Promise<Buffer> {
    // Inject text-rendering optimization for better text on Linux servers.
    // Check if SVG already has a style attribute to avoid duplication.
    let optimizedSvg = svgContent;
    if (!svgContent.includes('text-rendering')) {
      const svgTagMatch = svgContent.match(/<svg([^>]*)>/i);
      if (svgTagMatch) {
        const svgTag = svgTagMatch[0];
        const hasStyleAttr = /\sstyle\s*=/i.test(svgTag);

        if (hasStyleAttr) {
          // Merge with existing style attribute
          optimizedSvg = svgContent.replace(
            /(<svg[^>]*\sstyle\s*=\s*["'])([^"']*)/i,
            '$1$2; text-rendering: optimizeLegibility; shape-rendering: crispEdges'
          );
        } else {
          // Add new style attribute
          optimizedSvg = svgContent.replace(
            /<svg([^>]*)>/i,
            '<svg$1 style="text-rendering: optimizeLegibility; shape-rendering: crispEdges;">'
          );
        }
      }
    }

    const viewBoxWidth =
      intrinsic.w && intrinsic.w > 0 ? intrinsic.w : targetWidth;
    // V3: Use 120 DPI (vs 96 or 72) for sharper text that survives downscaling better.
    // 30% headroom ensures we always render slightly larger than target, then sharp
    // downscales with high-quality kernel = crisp text even on Linux servers.
    const density = Math.max(0.1, (120 * targetWidth * 1.3) / viewBoxWidth);

    const pipeline = sharp(Buffer.from(optimizedSvg, 'utf-8'), {
      density
    }).resize({
      width: targetWidth,
      withoutEnlargement: true,
      // Mitchell kernel is better for text than Lanczos3 (less ringing artifacts)
      kernel: 'mitchell'
    });

    // effort 4 instead of the optimizer's usual 6: at the top breakpoints this is a
    // ~250MP-viewBox decode, and encode effort 6 buys ~1% smaller output for nearly
    // 3x the time on a path that's already synchronous on a cache-miss request.
    return format === 'avif'
      ? pipeline
          .avif({ quality, effort: 4, chromaSubsampling: '4:4:4' })
          .toBuffer()
      : pipeline.webp({ quality, effort: 4, smartSubsample: true }).toBuffer();
  }

  getIntrinsicSize(svgContent: string): IntrinsicSize {
    const viewBox = VIEWBOX_RE.exec(svgContent);
    if (viewBox) {
      return { w: parseFloat(viewBox[3]), h: parseFloat(viewBox[4]) };
    }
    const width = WIDTH_RE.exec(svgContent);
    const height = HEIGHT_RE.exec(svgContent);
    return {
      w: width ? parseFloat(width[1]) : null,
      h: height ? parseFloat(height[1]) : null
    };
  }
}
