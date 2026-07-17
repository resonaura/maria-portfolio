import { RefObject, useEffect, useState } from 'react';

export interface SvgCirclePosition {
  /** left offset inside the img container, px */
  left: number;
  /** top offset inside the img container, px */
  top: number;
  /** circle radius in screen px */
  radius: number;
  ready: boolean;
}

/**
 * Tracks where an SVG circle (defined in viewBox coordinates) appears
 * on-screen relative to the img element's bounding box.
 *
 * SVG viewBox for 1.svg is 0 0 1440 3500.
 * Circle centre: cx=471.348, cy=2595.33, r=299.771.
 */
export function useSvgCirclePosition(
  imgRef: RefObject<HTMLImageElement | null>,
  svgViewBox = { w: 1440, h: 3500 },
  circle = { cx: 471.348, cy: 2595.33, r: 299.771 },
): SvgCirclePosition {
  const [pos, setPos] = useState<SvgCirclePosition>({
    left: 0,
    top: 0,
    radius: 0,
    ready: false,
  });

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;

    const compute = () => {
      const imgRect = img.getBoundingClientRect();
      const parentRect = img.parentElement!.getBoundingClientRect();

      // The img renders the SVG scaled uniformly to fit its box.
      // object-fit: cover means it may be clipped — but the artwork img
      // uses object-fit: cover with width: 100% / height: 100%.
      // We care about the rendered size of the img DOM element itself.
      const renderedW = imgRect.width;
      const renderedH = imgRect.height;

      // Scale from SVG coords → rendered px
      const sx = renderedW / svgViewBox.w;
      const sy = renderedH / svgViewBox.h;

      // Circle position relative to the img element's top-left corner,
      // then offset by img position within its parent (the container we
      // will place the overlay in).
      const imgOffsetLeft = imgRect.left - parentRect.left;
      const imgOffsetTop  = imgRect.top  - parentRect.top;

      setPos({
        left:   imgOffsetLeft + circle.cx * sx,
        top:    imgOffsetTop  + circle.cy * sy,
        radius: circle.r * sx,   // uniform scale → use sx
        ready:  true,
      });
    };

    const ro = new ResizeObserver(compute);
    ro.observe(img);
    img.addEventListener('load', compute);
    // Run immediately in case already loaded
    if (img.complete) compute();

    return () => {
      ro.disconnect();
      img.removeEventListener('load', compute);
    };
  }, [imgRef, svgViewBox, circle]);

  return pos;
}
