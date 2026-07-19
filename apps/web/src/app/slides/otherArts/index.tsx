import { motion } from 'framer-motion';
import { ArtImage } from '../../components/artImage';
import { fadeUp, fadeIn, viewportOnce } from '../../lib/motion';

import './index.scss';

export function OtherArtsSlide() {
  return (
    <section className='other-arts-slide'>
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
            packaging explores the tapestries of human interactions, the
            nature of care and sacrifice. Ultimately, it highlights the
            eclectic nature of love and the irony of life.
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
        />
        <div className='fade-overlay' aria-hidden='true' />
      </motion.div>
    </section>
  );
}
