export type ImageFormat = 'webp' | 'avif' | 'png' | 'jpeg' | 'svg';

export interface OptimizeOptions {
  width?: number;
  format?: Exclude<ImageFormat, 'svg'>;
  quality?: number;
  /**
   * webp/avif encoder effort. Defaults to 6, which is the right trade for ordinary
   * photo sources. Callers working with very large canvases should lower it: encode
   * time scales badly with pixel count, and at 36MP effort 6 costs 59s against 4.7s
   * for effort 4 while producing a ~3% smaller file (measured on 1-1.svg @3840).
   */
  effort?: number;
}

export interface OptimizedAsset {
  buffer: Buffer;
  mime: string;
}

export interface IntrinsicSize {
  w: number | null;
  h: number | null;
}
