import { SourceFileKind } from '../database/source-file.entity.js';

export interface VariantSpec {
  key: string;
  format: 'webp' | 'avif' | 'png' | 'jpeg' | 'svg' | 'vector';
  width: number | null;
  quality: number | null;
  ext: string;
}

export interface ManifestEntry {
  lqip: string;
  breakpoints: number[];
  type: SourceFileKind;
  intrinsic: { w: number | null; h: number | null };
  /** Content hash, appended to image URLs as a cache-busting query param so a
   * changed source file is fetched fresh instead of served from the browser's
   * long-lived immutable cache under the old, unchanged URL. */
  contentHash: string;
}

export type ImageManifest = Record<string, ManifestEntry>;

export interface ResolvedVariant {
  buffer: Buffer;
  mime: string;
  sourceHash: string;
  variantKey: string;
}
