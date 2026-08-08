export const BREAKPOINTS = [320, 640, 960, 1280, 1920, 2560, 3840] as const;
export const RASTER_FORMATS = ['webp', 'avif'] as const;
export const DEFAULT_QUALITY = 80;

// SVG → PNG converter version for Safari fallback. Increment when improving
// flattenToRaster quality (font rendering, spacing, etc.) to trigger automatic
// regeneration of existing variants on the next reconciliation sweep.
export const SVG_CONVERTER_VERSION = 5;

/**
 * Optional pre-rendered raster master for an SVG source: `arts/1-1.svg` pairs with
 * `arts/1-1.svg.master.png`. When present, the flattened webp/avif renditions (the
 * Safari fallback) are downscaled from it instead of rasterizing the SVG server-side.
 *
 * Two reasons this exists, both about moving work off the request path and off the
 * server's rendering stack:
 *  - Cost: rasterizing these sources through librsvg costs seconds per variant
 *    (measured: 7s for 1-1.svg @3840, 14s for 6-1.svg @3840), synchronously, on a
 *    cache miss. Downscaling a ready PNG is milliseconds.
 *  - Fidelity: librsvg resolves fonts through fontconfig, so text renders differently
 *    on the Linux prod box than it does locally. A master rendered where the fonts
 *    are correct removes that variable instead of compensating for it with DPI and
 *    kernel tuning.
 *
 * The suffix is appended to the full source filename (not swapped for the extension)
 * so a master can never collide with a real source file of its own.
 */
export const RASTER_MASTER_SUFFIX = '.master.png';
