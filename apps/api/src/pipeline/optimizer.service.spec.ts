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

  it('computes a brightness profile that tracks a top-to-bottom black-to-white gradient', async () => {
    const filePath = path.join(root, 'gradient.png');
    const bands = 8;
    // A vertical gradient, black at the top fading to white at the bottom.
    const raw = Buffer.alloc(bands * 4 * 3);
    for (let row = 0; row < bands; row++) {
      const value = Math.round((row / (bands - 1)) * 255);
      for (let col = 0; col < 4; col++) {
        const idx = (row * 4 + col) * 3;
        raw[idx] = raw[idx + 1] = raw[idx + 2] = value;
      }
    }
    await sharp(raw, { raw: { width: 4, height: bands, channels: 3 } }).png().toFile(filePath);

    const profile = await optimizer.computeBrightnessProfile(filePath, bands);

    expect(profile).toHaveLength(bands);
    expect(profile[0]).toBeLessThan(0.2); // top stays dark
    expect(profile[bands - 1]).toBeGreaterThan(0.8); // bottom stays light
    // Monotonically non-decreasing top to bottom, matching the source gradient.
    for (let i = 1; i < profile.length; i++) {
      expect(profile[i]).toBeGreaterThanOrEqual(profile[i - 1] - 0.05);
    }
  });

  it('returns an empty profile instead of throwing for an unreadable file', async () => {
    const profile = await optimizer.computeBrightnessProfile(path.join(root, 'does-not-exist.png'));
    expect(profile).toEqual([]);
  });
});
