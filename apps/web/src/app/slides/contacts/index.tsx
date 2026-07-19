import { buttonVariants, cn } from '@heroui/react';
import { motion } from 'framer-motion';
import { ProgressiveImage } from '@maria-portfolio/img-client';
import { Slide } from '../../components/slide';
import { useSvgRectPosition } from '../../hooks/useSvgRectPosition';
import { fadeIn, tapScale, viewportOnce } from '../../lib/motion';
import './index.scss';

const CONTACT_EMAIL = 'mailto:mkrotova444@gmail.com';

export function ContactsSlide() {
  const [cta, ctaRef] = useSvgRectPosition('cta-target');

  return (
    <Slide className='contacts-slide'>
      {/* Full-bleed 6-1 artwork — contact info is overlaid on the
          white rectangle inside the SVG (id="cta-target") */}
      <motion.div
        className='contacts-hero'
        variants={fadeIn}
        initial='hidden'
        whileInView='visible'
        viewport={viewportOnce}
      >
        <ProgressiveImage
          ref={ctaRef}
          src='arts/6-1.svg'
          alt='Contact background artwork'
          className='contacts-hero-img'
          aspectRatio='18000 / 14125'
        />

        {cta.ready && (
          <div
            className='contacts-cta'
            style={{
              left: cta.left,
              top: cta.top,
              width: cta.width,
              height: cta.height
            }}
          >
            <h2>Want to work together?</h2>
            <motion.button
              data-cursor='block'
              className={cn(
                buttonVariants({ variant: 'primary' }),
                'contact-me-button'
              )}
              onClick={() => window.open(CONTACT_EMAIL, '_blank')}
              whileTap={tapScale}
            >
              Contact Me
            </motion.button>
          </div>
        )}
      </motion.div>
    </Slide>
  );
}
