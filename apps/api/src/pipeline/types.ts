export type ImageFormat = 'webp' | 'avif' | 'png' | 'jpeg' | 'svg';

export interface OptimizeOptions {
  width?: number;
  format?: Exclude<ImageFormat, 'svg'>;
  quality?: number;
}

export interface OptimizedAsset {
  buffer: Buffer;
  mime: string;
}

export interface IntrinsicSize {
  w: number | null;
  h: number | null;
}
