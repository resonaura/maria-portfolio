export const BREAKPOINTS = [320, 640, 960, 1280, 1920, 2560, 3840] as const;
export const RASTER_FORMATS = ['webp', 'avif'] as const;
export const DEFAULT_QUALITY = 80;

// SVG → PNG converter version for Safari fallback. Increment when improving
// flattenToRaster quality (font rendering, spacing, etc.) to trigger automatic
// regeneration of existing variants on the next reconciliation sweep.
export const SVG_CONVERTER_VERSION = 3;
