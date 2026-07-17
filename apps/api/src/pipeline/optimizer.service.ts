import { Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { IntrinsicSize, OptimizeOptions, OptimizedAsset } from './types.js';

@Injectable()
export class OptimizerService {
  async optimizeRaster(filePath: string, options: OptimizeOptions): Promise<OptimizedAsset> {
    const pipeline = sharp(filePath);

    if (options.width) {
      pipeline.resize({ width: options.width, withoutEnlargement: true });
    }

    const format = options.format ?? 'webp';
    const quality = options.quality ?? 80;

    if (format === 'avif') {
      pipeline.avif({ quality, effort: 4 });
    } else if (format === 'webp') {
      pipeline.webp({ quality, effort: 4 });
    } else if (format === 'png') {
      pipeline.png({ quality, compressionLevel: 8 });
    } else {
      pipeline.jpeg({ quality, mozjpeg: true });
    }

    const buffer = await pipeline.toBuffer();
    return { buffer, mime: `image/${format}` };
  }

  async generateRasterLqip(filePath: string): Promise<string> {
    try {
      const buffer = await sharp(filePath).resize({ width: 20 }).webp({ quality: 20 }).toBuffer();
      return `data:image/webp;base64,${buffer.toString('base64')}`;
    } catch {
      return '';
    }
  }

  async getIntrinsicSize(filePath: string): Promise<IntrinsicSize> {
    try {
      const meta = await sharp(filePath).metadata();
      return { w: meta.width ?? null, h: meta.height ?? null };
    } catch {
      return { w: null, h: null };
    }
  }
}
