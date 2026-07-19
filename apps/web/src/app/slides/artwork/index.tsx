import { ProgressiveImage } from '@maria-portfolio/img-client';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useSvgCirclePosition } from '../../hooks/useSvgCirclePosition';
import { fadeIn, viewportOnce } from '../../lib/motion';
import './index.scss';

export interface IArtworkSlide {
  label: string;
}

// ── Ring constants ────────────────────────────────────────────────────────────
const RING_R = 158; // SVG units, radius in 300×300 viewBox
const RING_CX = 150;
const RING_CY = 150;
const RING_REPS = 5;
const ROTATING_LABEL =
  Array(RING_REPS).fill('GRAPHIC DESIGNER').join(' • ') + ' • ';

interface CharData {
  char: string;
  x: number;
  y: number;
  rotate: number;
}

/**
 * Fallback: equal angular spacing (used before fonts load).
 */
function buildEqual(): CharData[] {
  const chars = [...ROTATING_LABEL];
  const n = chars.length;
  return chars.map((char, i) => {
    const deg = -90 + (i / n) * 360;
    const rad = (deg * Math.PI) / 180;
    return {
      char,
      x: RING_CX + RING_R * Math.cos(rad),
      y: RING_CY + RING_R * Math.sin(rad),
      rotate: deg + 90
    };
  });
}

/**
 * Proportional spacing: each character arc segment = (charWidth / totalWidth) × circumference.
 * Character is centred in its segment so visual gaps are uniform.
 */
function buildMeasured(): CharData[] {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  // Measure at a large size for precision; ratios are scale-independent.
  ctx.font = '700 200px Outfit, Inter, sans-serif';

  const chars = [...ROTATING_LABEL];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const totalWidth = widths.reduce((s, w) => s + w, 0);
  const circum = 2 * Math.PI * RING_R;

  let arc = 0;
  return chars.map((char, i) => {
    const seg = (widths[i] / totalWidth) * circum; // arc segment for this char
    const centre = arc + seg / 2; // centre of segment
    const deg = -90 + (centre / circum) * 360;
    const rad = (deg * Math.PI) / 180;
    arc += seg;
    return {
      char,
      x: RING_CX + RING_R * Math.cos(rad),
      y: RING_CY + RING_R * Math.sin(rad),
      rotate: deg + 90
    };
  });
}

// ── Component ─────────────────────────────────────────────────────────────────
/** Full-viewport-width art slide with a dynamically-positioned quote overlay. */
export function ArtworkSlide({ label }: IArtworkSlide) {
  const [circle, circleRef] = useSvgCirclePosition();

  // Start with equal-spacing fallback, switch to measured once fonts load
  const [ringChars, setRingChars] = useState<CharData[]>(buildEqual);

  useEffect(() => {
    const measure = () => setRingChars(buildMeasured());
    // document.fonts.ready resolves after all fonts are loaded
    if (document.fonts?.ready) {
      document.fonts.ready.then(measure);
    } else {
      measure();
    }
  }, []);

  const innerFontSize = Math.max(9, circle.radius * 0.088);
  const innerPadding = Math.max(8, circle.radius * 0.16);

  return (
    <motion.section
      className='artwork-slide'
      variants={fadeIn}
      initial='hidden'
      whileInView='visible'
      viewport={viewportOnce}
    >
      <div className='artwork-img-wrap'>
        <ProgressiveImage
          ref={circleRef}
          src='arts/1-1.svg'
          alt={label}
          className='artwork-img'
        />

        {circle.ready && (
          <div
            className='quote-overlay'
            style={{
              left: circle.left - circle.radius,
              top: circle.top - circle.radius,
              width: circle.radius * 2,
              height: circle.radius * 2
            }}
          >
            {/*
             * Rotating ring: one <text> per character, placed at its
             * proportional arc position (measured via Canvas API).
             * CSS animation rotates the whole SVG. No textPath, no wrapping.
             */}
            <svg
              className='quote-ring'
              viewBox='0 0 300 300'
              aria-hidden='true'
            >
              {ringChars.map(({ char, x, y, rotate }, i) => (
                <text
                  key={i}
                  x={x}
                  y={y}
                  fontSize={13}
                  fontWeight={700}
                  fontFamily='Outfit, Inter, sans-serif'
                  fill='currentColor'
                  textAnchor='middle'
                  dominantBaseline='auto'
                  transform={`rotate(${rotate}, ${x}, ${y})`}
                >
                  {char}
                </text>
              ))}
            </svg>

            {/* Inner quote text – font-size and padding derived from radius */}
            <div className='quote-inner' style={{ padding: innerPadding }}>
              <p style={{ fontSize: innerFontSize }}>
                I love to create. I believe in taking even small opportunities.
                Every project I took part in has changed me, tought me something
                and aided my growth on my professional journey.
              </p>
            </div>
          </div>
        )}
      </div>
    </motion.section>
  );
}
