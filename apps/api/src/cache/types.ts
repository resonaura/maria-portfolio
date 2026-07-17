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
}

export type ImageManifest = Record<string, ManifestEntry>;

export interface ResolvedVariant {
  buffer: Buffer;
  mime: string;
  sourceHash: string;
  variantKey: string;
}
