import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';
import { SvgService } from './svg.service.js';

async function tinyPngBase64(): Promise<string> {
  const buffer = await sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 200, g: 40, b: 40 } }
  })
    .png()
    .toBuffer();
  return buffer.toString('base64');
}

describe('SvgService', () => {
  const svg = new SvgService();
  let rasterBase64: string;

  beforeAll(async () => {
    rasterBase64 = await tinyPngBase64();
  });

  it('detects embedded raster images', () => {
    const content = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8"><image href="data:image/png;base64,${rasterBase64}" /></svg>`;
    const rasters = svg.findEmbeddedRasters(content);
    expect(rasters).toHaveLength(1);
    expect(rasters[0].mime).toBe('image/png');
  });

  it('classifies vector-only SVGs correctly', () => {
    const content = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>';
    expect(svg.classify(content)).toBe('svg-vector');
  });

  it('classifies SVGs with embedded rasters correctly', () => {
    const content = `<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,${rasterBase64}" /></svg>`;
    expect(svg.classify(content)).toBe('svg-with-raster');
  });

  it('replaces every occurrence of a duplicated embedded raster, not just the first', async () => {
    // Two <image> tags embedding byte-identical raster data — a real bug in the
    // previous implementation used String.replace() (first-match-only) here, which
    // left the second occurrence unoptimized.
    const content = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8">
      <image href="data:image/png;base64,${rasterBase64}" x="0" />
      <image href="data:image/png;base64,${rasterBase64}" x="8" />
    </svg>`;

    const result = await svg.optimizeEmbeddedRasters(content, 4, 80);
    const remainingOriginal = result.split(rasterBase64).length - 1;
    expect(remainingOriginal).toBe(0);

    const rastersAfter = svg.findEmbeddedRasters(result);
    expect(rastersAfter).toHaveLength(2);
    expect(rastersAfter[0].base64).toBe(rastersAfter[1].base64);
  });

  it('parses viewBox with whitespace separators', () => {
    const content = '<svg viewBox="0 0 120 80"></svg>';
    expect(svg.getIntrinsicSize(content)).toEqual({ w: 120, h: 80 });
  });

  it('parses viewBox with comma separators (valid per SVG spec)', () => {
    const content = '<svg viewBox="0,0,120,80"></svg>';
    expect(svg.getIntrinsicSize(content)).toEqual({ w: 120, h: 80 });
  });

  it('falls back to width/height attributes when viewBox is absent', () => {
    const content = '<svg width="200px" height="150px"></svg>';
    expect(svg.getIntrinsicSize(content)).toEqual({ w: 200, h: 150 });
  });

  it('minifies vector markup while preserving viewBox and dimensions', () => {
    const content =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><!-- comment --><g><g><circle cx="12" cy="12" r="10"/></g></g></svg>';
    const minified = svg.minifyVector(content);
    expect(minified).toContain('viewBox="0 0 24 24"');
    expect(minified.length).toBeLessThan(content.length);
    expect(minified).not.toContain('<!-- comment -->');
  });

  it('strips <script> tags and on* event handlers as a sanitization pass', () => {
    const content =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script><circle cx="5" cy="5" r="4" onclick="alert(2)"/></svg>';
    const minified = svg.minifyVector(content);
    expect(minified).not.toContain('<script');
    expect(minified).not.toContain('onclick');
  });
});
