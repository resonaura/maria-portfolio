import { motion } from 'framer-motion';
import { ArtImage } from '../../components/artImage';
import { fadeIn, viewportOnce } from '../../lib/motion';

import './index.scss';

export function KhinkaliSlide() {
  return (
    <section className='khinkali-slide'>
      <motion.div
        className='poster-container'
        variants={fadeIn}
        initial='hidden'
        whileInView='visible'
        viewport={viewportOnce}
      >
        <ArtImage
          src='arts/5-1.png'
          alt='Khinkali illustration'
          className='poster-image'
        />
      </motion.div>

      <div className='transparent-gap' aria-hidden='true' />

      <motion.div
        className='poster-container'
        variants={fadeIn}
        initial='hidden'
        whileInView='visible'
        viewport={viewportOnce}
      >
        <ArtImage
          src='arts/5-2.png'
          alt='Khinkali illustration'
          className='poster-image'
        />
      </motion.div>
    </section>
  );
}
