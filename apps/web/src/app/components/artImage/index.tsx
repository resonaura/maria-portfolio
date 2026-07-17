import { ProgressiveImage } from '@maria-portfolio/img-client';
import './index.scss';

export interface IArtImage {
  src: string;
  alt: string;
  aspectRatio?: string;
  className?: string;
}

export function ArtImage({ src, alt, aspectRatio, className }: IArtImage) {
  // Normalize leading slash to match manifest keys (e.g. '/arts/1.png' -> 'arts/1.png')
  const normalizedSrc = src.replace(/^\//, '');

  return (
    <ProgressiveImage
      src={normalizedSrc}
      alt={alt}
      aspectRatio={aspectRatio}
      className={'art-image' + (className ? ` ${className}` : '')}
    />
  );
}

