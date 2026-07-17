export interface ImageManifestEntry {
  lqip: string;
  breakpoints: number[];
  type: 'raster' | 'svg-with-raster' | 'svg-vector';
  intrinsic: { w: number | null; h: number | null };
}

export interface ImageManifest {
  [filePath: string]: ImageManifestEntry;
}
