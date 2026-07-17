import { ImageIcon } from 'lucide-react';
import './index.scss';

export interface IArtPlaceholder {
  label: string;
  aspectRatio?: string;
  className?: string;
}

/**
 * Stands in for ArtImage until real artwork exists — same slot shape,
 * so swapping one for the other later is a one-line change per project entry.
 */
export function ArtPlaceholder({
  label,
  aspectRatio,
  className
}: IArtPlaceholder) {
  return (
    <div
      className={'art-placeholder' + (className ? ` ${className}` : '')}
      style={{ aspectRatio }}
    >
      <ImageIcon size={32} strokeWidth={1.5} />
      <span>{label}</span>
    </div>
  );
}
