export interface Intrinsic {
  w: number | null;
  h: number | null;
}

/**
 * CSS aspect-ratio string derived from manifest intrinsic dimensions. Every
 * progressive-loading container needs a determinate height from first paint —
 * a plain <img> gets that for free from its own intrinsic size, but an empty
 * container we fill in imperatively (the inline-SVG DOM-patch path) or one
 * whose <img> hasn't loaded yet does not, and collapses to zero height without
 * this, breaking anything that measures the container's rendered box.
 */
export function intrinsicAspectRatio(intrinsic?: Intrinsic | null): string | undefined {
  if (!intrinsic?.w || !intrinsic?.h) return undefined;
  return `${intrinsic.w} / ${intrinsic.h}`;
}
