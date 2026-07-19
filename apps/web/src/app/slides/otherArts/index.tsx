import { motion } from 'framer-motion';
import { ArtImage } from '../../components/artImage';
import { fadeIn, fadeUp, viewportOnce } from '../../lib/motion';

import './index.scss';

export function OtherArtsSlide() {
  return (
    <section className='other-arts-slide'>
      <motion.div
        className='full-bleed-container'
        variants={fadeIn}
        initial='hidden'
        whileInView='visible'
        viewport={viewportOnce}
      >
        <ArtImage
          src='arts/3-5.svg'
          alt='Section divider'
          className='full-bleed-image'
          aspectRatio='12000 / 303'
        />
      </motion.div>
      <motion.div
        className='packaging-intro'
        variants={fadeUp}
        initial='hidden'
        whileInView='visible'
        viewport={viewportOnce}
      >
        <div className='packaging-intro-inner'>
          <h3>Packaging based on "The Gift of the Magi"</h3>
          <p>
            Taking inspiration from O'Henry's "The Gift of the Magi", this
            packaging explores the tapestries of human interactions, the nature
            of care and sacrifice. Ultimately, it highlights the eclectic nature
            of love and the irony of life.
          </p>
        </div>
      </motion.div>

      <motion.div
        className='poster-container poster-container--fade-top'
        variants={fadeIn}
        initial='hidden'
        whileInView='visible'
        viewport={viewportOnce}
      >
        <ArtImage
          src='arts/4-1.png'
          alt='Other artwork illustration'
          className='poster-image'
          aspectRatio='3276 / 32767'
        />
        <div className='fade-overlay' aria-hidden='true' />
      </motion.div>
    </section>
  );
}
