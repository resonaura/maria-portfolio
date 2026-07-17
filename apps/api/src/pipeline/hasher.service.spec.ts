import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HasherService } from './hasher.service.js';

describe('HasherService', () => {
  let dir: string;
  let filePath: string;
  let hasher: HasherService;

  beforeEach(async () => {
    hasher = new HasherService();
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'hasher-test-'));
    filePath = path.join(dir, 'file.txt');
    await fs.writeFile(filePath, 'hello world');
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it('produces a stable hash for unchanged content', async () => {
    const a = await hasher.hashContent(filePath);
    const b = await hasher.hashContent(filePath);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces a different hash when content changes', async () => {
    const before = await hasher.hashContent(filePath);
    await fs.writeFile(filePath, 'goodbye world');
    const after = await hasher.hashContent(filePath);
    expect(after).not.toBe(before);
  });

  it('exposes size and mtime via stat', async () => {
    const fingerprint = await hasher.stat(filePath);
    expect(fingerprint.size).toBe(Buffer.byteLength('hello world'));
    expect(fingerprint.mtimeMs).toBeGreaterThan(0);
  });

  it('builds an order-independent, stable variant key', () => {
    const a = hasher.variantKey({ w: 640, f: 'avif', q: 80 });
    const b = hasher.variantKey({ q: 80, w: 640, f: 'avif' });
    expect(a).toBe(b);
    expect(a).toBe('f=avif;q=80;w=640');
  });

  it('omits undefined values from the variant key', () => {
    const key = hasher.variantKey({ w: 640, f: undefined, q: 80 });
    expect(key).toBe('q=80;w=640');
  });
});
