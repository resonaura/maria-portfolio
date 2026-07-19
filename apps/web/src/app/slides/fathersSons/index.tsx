import { motion } from 'framer-motion';
import { ArtImage } from '../../components/artImage';
import {
  fadeIn,
  fadeUp,
  staggerContainer,
  viewportOnce
} from '../../lib/motion';

import './index.scss';

export function FathersSonsSlide() {
  return (
    <section className='fathers-sons-slide'>
      {/* Block 1: Logo 2-1.svg */}
      <motion.div
        className='logo-container'
        variants={fadeUp}
        initial='hidden'
        whileInView='visible'
        viewport={viewportOnce}
      >
        <div className='logo-wrapper'>
          <ArtImage
            src='arts/2-1.svg'
            alt='Fathers and Sons logo'
            aspectRatio='34 / 13'
          />
        </div>
      </motion.div>

      {/* Block 2: Logo description */}
      <motion.div
        className='description-container text-content-width'
        variants={fadeUp}
        initial='hidden'
        whileInView='visible'
        viewport={viewportOnce}
      >
        <p className='highlighted-text'>
          Symbolizing the generational continuity of cultural heritage, this
          logo portrays a father and son gazing at each other. Set against the
          backdrop of a book, it signiﬁes the shared love of literature as a
          point of unity.
        </p>
      </motion.div>

      {/* Block 3: Logo grid/variant 2-2.svg */}
      <motion.div
        className='symbol-container'
        variants={fadeUp}
        initial='hidden'
        whileInView='visible'
        viewport={viewportOnce}
      >
        <div className='symbol-wrapper'>
          <ArtImage
            src='arts/2-2.svg'
            alt='Fathers and Sons graphic mark'
            aspectRatio='81 / 33'
          />
        </div>
      </motion.div>

      {/* Block 4: Book spread / identity image 2-3.svg (Full bleed) */}
      <motion.div
        className='full-bleed-container'
        variants={fadeIn}
        initial='hidden'
        whileInView='visible'
        viewport={viewportOnce}
      >
        <ArtImage
          src='arts/2-3.svg'
          alt='Fathers and Sons design identity'
          className='full-bleed-image'
          aspectRatio='116 / 35'
        />
      </motion.div>

      {/* Block 5: Design & Vision text block */}
      <motion.div
        className='vision-container text-content-width'
        variants={fadeUp}
        initial='hidden'
        whileInView='visible'
        viewport={viewportOnce}
      >
        <h3>Design & Vision</h3>
        <p>
          I had the privilege of spearheading the development of the identity of
          the nationwide literary family reading competition across Russia. My
          creative and rigorous approach to design resulted in the creation of
          printed materials and a logo that to this day continues to resonate
          with target audiences.
        </p>
      </motion.div>

      {/* Block 6: Identity showcase 2-4.svg (Full bleed) */}
      <motion.div
        className='full-bleed-container'
        variants={fadeIn}
        initial='hidden'
        whileInView='visible'
        viewport={viewportOnce}
      >
        <ArtImage
          src='arts/2-4.svg'
          alt='Competition brand showcase'
          className='full-bleed-image'
          aspectRatio='1440 / 2100'
        />
      </motion.div>

      {/* Block 7: Portraits block */}
      <div className='portraits-section'>
        <motion.h3
          className='portraits-title'
          variants={fadeUp}
          initial='hidden'
          whileInView='visible'
          viewport={viewportOnce}
        >
          Portraits for social networks
        </motion.h3>

        <motion.div
          className='portraits-grid'
          variants={staggerContainer}
          initial='hidden'
          whileInView='visible'
          viewport={viewportOnce}
        >
          {/* Portrait 1: Sergei Yesenin */}
          <motion.div className='portrait-card' variants={fadeUp}>
            <div className='portrait-img-wrap'>
              <ArtImage
                src='arts/2-5.svg'
                alt='Sergei Alexandrovich Yesenin'
                aspectRatio='3 / 4'
              />
            </div>
            <h4>Sergei Alexandrovich Yesenin</h4>
            <p>
              Renowed Russian lyric poet of the 20th century. To this day, he is
              one of the most popular and well-known Russian poets.
            </p>
          </motion.div>

          {/* Portrait 2: Alexander Pushkin */}
          <motion.div className='portrait-card' variants={fadeUp}>
            <div className='portrait-img-wrap'>
              <ArtImage
                src='arts/2-6.svg'
                alt='Alexander Sergeyevich Pushkin'
                aspectRatio='3 / 4'
              />
            </div>
            <h4>Alexander Sergeyevich Pushkin</h4>
            <p>
              Russian poet, playwright, and novelist of the Romantic era. He is
              considered by many to be the greatest Russian poet and the founder
              of modern Russian literature.
            </p>
          </motion.div>

          {/* Portrait 3: Mikhail Lermontov */}
          <motion.div className='portrait-card' variants={fadeUp}>
            <div className='portrait-img-wrap'>
              <ArtImage
                src='arts/2-7.svg'
                alt='Mikhail Yuryevich Lermontov'
                aspectRatio='3 / 4'
              />
            </div>
            <h4>Mikhail Yuryevich Lermontov</h4>
            <p>
              Russian Romantic writer, poet and painter, sometimes called "the
              poet of the Caucasus", considered the most important Russian poet
              after Alexander Pushkin.
            </p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
