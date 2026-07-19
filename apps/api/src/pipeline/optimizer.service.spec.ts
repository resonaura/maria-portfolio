import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OptimizerService } from './optimizer.service.js';

describe('OptimizerService', () => {
  let root: string;
  let optimizer: OptimizerService;

  beforeEach(async () => {
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'optimizer-test-'));
    optimizer = new OptimizerService();
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  it('caps output dimensions for an extreme-aspect-ratio source so WebP stays under its 16383px limit', async () => {
    const filePath = path.join(root, 'tall.png');
    // Mirrors a long vertical scroll graphic: at a normal breakpoint width, a naive
    // width-only resize would scale the height past WebP's hard dimension cap.
    await sharp({
      create: { width: 300, height: 20000, channels: 3, background: { r: 10, g: 20, b: 30 } }
    })
      .png()
      .toFile(filePath);

    const { buffer } = await optimizer.optimizeRaster(filePath, { width: 1920, format: 'webp', quality: 80 });

    const meta = await sharp(buffer).metadata();
    expect(meta.width).toBeLessThanOrEqual(16000);
    expect(meta.height).toBeLessThanOrEqual(16000);
  });

  it('resizes a normal-aspect-ratio source to the requested width unaffected by the height cap', async () => {
    const filePath = path.join(root, 'normal.png');
    await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 100, g: 100, b: 100 } }
    })
      .png()
      .toFile(filePath);

    const { buffer } = await optimizer.optimizeRaster(filePath, { width: 400, format: 'webp', quality: 80 });

    const meta = await sharp(buffer).metadata();
    expect(meta.width).toBe(400);
    expect(meta.height).toBe(300);
  });
});
