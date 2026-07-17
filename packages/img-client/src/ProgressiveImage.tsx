import React, { forwardRef, useEffect, useRef, useState } from 'react';
import { intrinsicAspectRatio } from './aspectRatio.js';
import { useImgManifest } from './context.js';
import { useProgressiveImage } from './useProgressiveImage.js';
import { useProgressiveSvg } from './useProgressiveSvg.js';

export interface ProgressiveImageProps {
  src: string;
  alt: string;
  aspectRatio?: string;
  className?: string;
  style?: React.CSSProperties;
}

function containerStyle(aspectRatio: string | undefined, style: React.CSSProperties | undefined): React.CSSProperties {
  return {
    position: 'relative',
    overflow: 'hidden',
    aspectRatio,
    backgroundColor: '#1a1a1a',
    ...style
  };
}

/** Raster photos (webp/avif): LQIP blur-fade in, then invisibly preload each breakpoint
 * upgrade and swap once fully loaded so nothing ever pops in unloaded. */
const RasterProgressiveImage = forwardRef<HTMLDivElement, ProgressiveImageProps>(function RasterProgressiveImage(
  { src, alt, aspectRatio, className = '', style = {} },
  forwardedRef
) {
  const { ref: hookRef, src: targetSrc, lqip, isLoaded, intrinsic } = useProgressiveImage(src);

  const [currentSrc, setCurrentSrc] = useState<string | null>(null);
  const [pendingSrc, setPendingSrc] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const lastStableSrc = useRef<string | null>(null);

  const setRef = (node: HTMLDivElement | null) => {
    hookRef(node);
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  const resolvedAspectRatio = aspectRatio ?? intrinsicAspectRatio(intrinsic);

  useEffect(() => {
    if (!isLoaded || !targetSrc) return;
    if (!currentSrc) {
      setCurrentSrc(targetSrc);
      lastStableSrc.current = targetSrc;
    } else if (targetSrc !== lastStableSrc.current) {
      setPendingSrc(targetSrc);
      setIsTransitioning(true);
    }
  }, [targetSrc, isLoaded, currentSrc]);

  const handlePendingLoad = () => {
    if (!pendingSrc) return;
    setCurrentSrc(pendingSrc);
    lastStableSrc.current = pendingSrc;
    setPendingSrc(null);
    setIsTransitioning(false);
  };

  return (
    <div ref={setRef} className={`progressive-image-container ${className}`} style={containerStyle(resolvedAspectRatio, style)}>
      {lqip && (
        <img
          src={lqip}
          alt=""
          aria-hidden="true"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'blur(20px)',
            transform: 'scale(1.1)',
            transition: 'opacity 0.6s ease',
            opacity: currentSrc ? 0 : 1,
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 1
          }}
        />
      )}
      {currentSrc && (
        <img
          src={currentSrc}
          alt={alt}
          decoding="async"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'opacity 0.5s ease-in-out',
            opacity: isTransitioning ? 0.7 : 1,
            position: 'relative',
            zIndex: 2
          }}
        />
      )}
      {pendingSrc && (
        <img
          src={pendingSrc}
          alt=""
          decoding="async"
          onLoad={handlePendingLoad}
          onError={handlePendingLoad}
          style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0, opacity: 0, zIndex: 0 }}
        />
      )}
    </div>
  );
});

/** Pure-vector SVGs: a single SVGO-minified variant, resolution-independent by nature — no breakpoints, no LQIP needed. */
const VectorSvgImage = forwardRef<HTMLDivElement, ProgressiveImageProps>(function VectorSvgImage(
  { src, alt, aspectRatio, className = '', style = {} },
  forwardedRef
) {
  const { manifest } = useImgManifest();
  const [loaded, setLoaded] = useState(false);
  const resolvedAspectRatio = aspectRatio ?? intrinsicAspectRatio(manifest[src]?.intrinsic);
  return (
    <div ref={forwardedRef} className={`progressive-image-container ${className}`} style={containerStyle(resolvedAspectRatio, style)}>
      <img
        src={`/img/${src}`}
        alt={alt}
        decoding="async"
        onLoad={() => setLoaded(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: loaded ? 1 : 0, transition: 'opacity 0.4s ease' }}
      />
    </div>
  );
});

/** SVGs with embedded raster art: inline DOM-patched progressive loading (see useProgressiveSvg). */
const InlineSvgProgressiveImage = forwardRef<HTMLDivElement, ProgressiveImageProps>(function InlineSvgProgressiveImage(
  { src, alt, aspectRatio, className = '', style = {} },
  forwardedRef
) {
  const { ref: hookRef, intrinsic } = useProgressiveSvg(src, alt);

  const setRef = (node: HTMLDivElement | null) => {
    hookRef(node);
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  const resolvedAspectRatio = aspectRatio ?? intrinsicAspectRatio(intrinsic);

  return <div ref={setRef} className={`progressive-image-container ${className}`} style={containerStyle(resolvedAspectRatio, style)} />;
});

/** Routes by manifest-declared type. Falls back to the raster path (which itself has
 * its own LQIP/w=320 fallback) until the manifest has loaded. */
export const ProgressiveImage = forwardRef<HTMLDivElement, ProgressiveImageProps>(function ProgressiveImage(props, forwardedRef) {
  const { manifest } = useImgManifest();
  const type = manifest[props.src]?.type;

  if (type === 'svg-with-raster') return <InlineSvgProgressiveImage {...props} ref={forwardedRef} />;
  if (type === 'svg-vector') return <VectorSvgImage {...props} ref={forwardedRef} />;
  return <RasterProgressiveImage {...props} ref={forwardedRef} />;
});
