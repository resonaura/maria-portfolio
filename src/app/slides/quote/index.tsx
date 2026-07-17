import { motion } from 'framer-motion';
import { Slide } from '../../components/slide';
import { ArtPlaceholder } from '../../components/artPlaceholder';
import { fadeIn, viewportOnce } from '../../lib/motion';
import './index.scss';

const ROTATING_LABEL = Array(6).fill('graphic designer').join(' • ');

export function QuoteSlide() {
  return (
    <Slide className='quote-slide'>
      <div className='slide-content'>
        <div className='quote-circle-wrap'>
          <svg
            className='rotating-text'
            viewBox='0 0 300 300'
            aria-hidden='true'
          >
            <defs>
              <path
                id='quote-circle-path'
                d='M 150, 150 m -130, 0 a 130,130 0 1,1 260,0 a 130,130 0 1,1 -260,0'
              />
            </defs>
            <text>
              <textPath href='#quote-circle-path' startOffset='0%'>
                {ROTATING_LABEL}
              </textPath>
            </text>
          </svg>

          <motion.div
            className='quote-circle'
            initial={{ opacity: 0, scale: 0.85 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={viewportOnce}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <p>
              I love to create. I believe in taking even small opportunities.
              Every project I took part in has changed me, tought me something
              and aided my growth on my professional journey.
            </p>
          </motion.div>
        </div>

        <motion.div
          variants={fadeIn}
          initial='hidden'
          whileInView='visible'
          viewport={viewportOnce}
        >
          <ArtPlaceholder
            label='Illustration'
            aspectRatio='3 / 4'
            className='quote-illustration'
          />
        </motion.div>
      </div>
    </Slide>
  );
}
