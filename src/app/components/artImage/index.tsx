import { useState } from 'react';
import './index.scss';

export interface IArtImage {
  src: string;
  alt: string;
  aspectRatio?: string;
  className?: string;
}

/**
 * Resolves `src` straight to a static path today. When the NestJS image
 * pipeline lands, only this component needs to change (e.g. point at
 * `/api/images/optimize?src=...`) — every call site stays the same.
 */
export function ArtImage({ src, alt, aspectRatio, className }: IArtImage) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div
      className={
        'art-image' +
        (isLoaded ? ' loaded' : '') +
        (className ? ` ${className}` : '')
      }
      style={{ aspectRatio }}
    >
      <img
        src={src}
        alt={alt}
        loading='lazy'
        decoding='async'
        onLoad={() => setIsLoaded(true)}
      />
    </div>
  );
}
