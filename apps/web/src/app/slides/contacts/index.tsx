import { buttonVariants } from '@heroui/react';
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
            <p className='contacts-cta-label'>Со мной можно связаться</p>
            <h2>Let&apos;s build something great</h2>
            <motion.a
              data-cursor='block'
              className={buttonVariants({ variant: 'primary' })}
              href={CONTACT_EMAIL}
              whileHover={{ y: -2 }}
              whileTap={tapScale}
            >
              Contact Me
            </motion.a>
          </div>
        )}
      </motion.div>
    </Slide>
  );
}
