#!/usr/bin/env node
/**
 * Renders a pre-rasterized master PNG next to every svg-with-raster source, so the
 * server can downscale from it instead of running librsvg per cache miss (see
 * RASTER_MASTER_SUFFIX in src/cache/constants.ts for why).
 *
 * Run this locally — that's the point. The rendering machine's fonts are what end up
 * baked into the master, and the prod box's fontconfig doesn't have them.
 *
 *   node scripts/build-masters.mjs [--force] [--width 3840] [--only 1-1]
 *
 * The masters are plain PNGs at a known path; nothing here is privileged. Exporting
 * `arts/1-1.svg.master.png` by hand out of Figma/Illustrator is equally valid, and
 * preferable when a design tool renders effects that librsvg doesn't support.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const RASTER_MASTER_SUFFIX = '.master.png';
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_DIR =
  process.env.STORAGE_DIR ?? path.resolve(scriptDir, '..', 'storage');

// Matches BREAKPOINTS' top tier in src/cache/constants.ts: variants only ever
// downscale (withoutEnlargement), so rendering wider than this buys nothing.
const DEFAULT_WIDTH = 3840;
// Render above target, then downscale into it — the extra samples are what keep
// thin strokes and text edges from aliasing, same reasoning as the server's path.
const SUPERSAMPLE = 1.3;

const IMAGE_TAG_RE = /<image\s+([^>]*?)>/gi;
const DATA_URI_RE = /(?:href|xlink:href)=["']data:image\/\w+;base64,/i;
const VIEWBOX_RE =
  /viewBox=["']\s*([0-9.-]+)[\s,]+([0-9.-]+)[\s,]+([0-9.]+)[\s,]+([0-9.]+)\s*["']/i;

function parseArgs(argv) {
  const args = { force: false, width: DEFAULT_WIDTH, only: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--force') args.force = true;
    else if (argv[i] === '--width') args.width = parseInt(argv[++i], 10);
    else if (argv[i] === '--only') args.only = argv[++i];
    else {
      console.error(`Unknown argument: ${argv[i]}`);
      process.exit(1);
    }
  }
  if (!Number.isFinite(args.width) || args.width <= 0) {
    console.error('--width must be a positive integer');
    process.exit(1);
  }
  return args;
}

async function walk(dir) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

/** Mirrors SvgService.classify: only sources with embedded rasters get flattened
 * webp/avif variants, so only those have anything to gain from a master. */
function hasEmbeddedRaster(svgContent) {
  IMAGE_TAG_RE.lastIndex = 0;
  let match;
  while ((match = IMAGE_TAG_RE.exec(svgContent)) !== null) {
    if (DATA_URI_RE.test(match[0])) return true;
  }
  return false;
}

async function isStale(masterPath, svgPath) {
  try {
    const [master, svg] = await Promise.all([
      fs.stat(masterPath),
      fs.stat(svgPath)
    ]);
    return master.mtimeMs < svg.mtimeMs;
  } catch {
    return true; // no master yet
  }
}

async function render(svgPath, width) {
  const svg = await fs.readFile(svgPath);
  const viewBox = VIEWBOX_RE.exec(svg.toString('utf-8', 0, 8000));
  const viewBoxWidth = viewBox ? parseFloat(viewBox[3]) : width;

  // librsvg treats 72dpi as 1 user unit per pixel, so this density lands the native
  // decode at width*SUPERSAMPLE px regardless of how large the viewBox declares
  // itself — without it, an 18000-unit viewBox decodes at 18000px wide.
  const density = Math.max(0.1, (72 * width * SUPERSAMPLE) / viewBoxWidth);

  return sharp(svg, { density, limitInputPixels: false })
    .resize({ width, withoutEnlargement: true, kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toBuffer({ resolveWithObject: true });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let files;
  try {
    files = await walk(STORAGE_DIR);
  } catch (error) {
    console.error(`Cannot read storage dir ${STORAGE_DIR}: ${error.message}`);
    process.exit(1);
  }

  const svgs = files
    .filter((f) => f.toLowerCase().endsWith('.svg'))
    .filter((f) => !args.only || f.includes(args.only))
    .sort();

  if (svgs.length === 0) {
    console.log(`No SVG sources found under ${STORAGE_DIR}`);
    return;
  }

  console.log(`Storage: ${STORAGE_DIR}`);
  console.log(`Target width: ${args.width}px\n`);

  let built = 0;
  let skipped = 0;
  let failed = 0;

  for (const svgPath of svgs) {
    const rel = path.relative(STORAGE_DIR, svgPath);
    const content = await fs.readFile(svgPath, 'utf-8');

    if (!hasEmbeddedRaster(content)) {
      console.log(`—  ${rel} (pure vector, served as-is — no master needed)`);
      skipped++;
      continue;
    }

    const masterPath = svgPath + RASTER_MASTER_SUFFIX;
    if (!args.force && !(await isStale(masterPath, svgPath))) {
      console.log(`=  ${rel} (master up to date)`);
      skipped++;
      continue;
    }

    process.stdout.write(`⧗  ${rel} ... `);
    const started = Date.now();
    try {
      const { data, info } = await render(svgPath, args.width);
      await fs.writeFile(masterPath, data);
      console.log(
        `${info.width}x${info.height}, ${(data.length / 1e6).toFixed(1)}MB, ${((Date.now() - started) / 1000).toFixed(1)}s`
      );
      built++;
    } catch (error) {
      console.log(`FAILED: ${error.message}`);
      failed++;
    }
  }

  console.log(`\n${built} built, ${skipped} skipped, ${failed} failed`);
  if (built > 0) {
    console.log(
      'Masters written next to their sources. Sync storage/ to prod and the API ' +
        'will pick them up on its next reconcile.'
    );
  }
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
