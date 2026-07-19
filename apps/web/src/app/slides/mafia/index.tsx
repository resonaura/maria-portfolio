import { motion } from 'framer-motion';
import { ArtImage } from '../../components/artImage';
import {
  fadeIn,
  fadeUp,
  staggerContainer,
  viewportOnce
} from '../../lib/motion';

import './index.scss';

export function MafiaSlide() {
  return (
    <section className='mafia-slide'>
      {/* Block 1: Intro text block */}
      <motion.div
        className='intro-container text-content-width'
        variants={fadeUp}
        initial='hidden'
        whileInView='visible'
        viewport={viewportOnce}
      >
        <h3>The Mafia Game Deck</h3>
        <p>
          While working at a print shop, I embarked on a project designing a
          deck of cards for a sports-themed version of the Mafia game. Our
          client, a huge fan of the game, wanted each role to embody the
          unique characteristics associated with them.
        </p>
        <p>
          In approaching this, our team decided to represent each in-game role
          with an animal, encapsulating their distinctive features and
          bringing a new aesthetic to the game.
        </p>
      </motion.div>

      {/* Block 2: Vertical spacing + poster/illustration 3-1.png */}
      <div className='transparent-gap' aria-hidden='true' />

      <motion.div
        className='poster-container'
        variants={fadeIn}
        initial='hidden'
        whileInView='visible'
        viewport={viewportOnce}
      >
        <ArtImage
          src='arts/3-1.png'
          alt='The Mafia Game Deck illustration poster'
          className='poster-image'
          aspectRatio='6000 / 11020'
        />
      </motion.div>

      {/* Block 3: Animal portraits */}
      <div className='portraits-section'>
        <motion.div
          className='portraits-grid'
          variants={staggerContainer}
          initial='hidden'
          whileInView='visible'
          viewport={viewportOnce}
        >
          {/* Portrait 1: The Lion */}
          <motion.div className='portrait-card' variants={fadeUp}>
            <div className='portrait-img-wrap'>
              <ArtImage src='arts/3-2.svg' alt='The Lion' aspectRatio='3 / 4' />
            </div>
            <h4>The Lion</h4>
            <p>
              The king of the animal kingdom is undoubtedly the lion, which is
              why we deemed him the best pick to illustrate the Don – he does
              "rule" his cunning and sinister team.
            </p>
          </motion.div>

          {/* Portrait 2: The Dog */}
          <motion.div className='portrait-card' variants={fadeUp}>
            <div className='portrait-img-wrap'>
              <ArtImage src='arts/3-3.svg' alt='The Dog' aspectRatio='3 / 4' />
            </div>
            <h4>The Dog</h4>
            <p>
              A dog seemed the only right fit for the Sheriff's role. A kind
              heart dedicated to do his job, yet vigilant and ready to battle
              even the king of the animals.
            </p>
          </motion.div>

          {/* Portrait 3: The Rabbit */}
          <motion.div className='portrait-card' variants={fadeUp}>
            <div className='portrait-img-wrap'>
              <ArtImage
                src='arts/3-4.svg'
                alt='The Rabbit'
                aspectRatio='3 / 4'
              />
            </div>
            <h4>The Rabbit</h4>
            <p>
              Nimble and wary by nature, rabbits can reach incredible speeds
              running away from predators. Nature has its ways of protecting
              the meek; in Mafia, you ought to be prompt in your argumentation
              to stay alive.
            </p>
          </motion.div>
        </motion.div>
      </div>

      {/* Block 4: Sketches note */}
      <motion.div
        className='sketches-container text-content-width'
        variants={fadeUp}
        initial='hidden'
        whileInView='visible'
        viewport={viewportOnce}
      >
        <p className='highlighted-text'>
          Creating these sketches, our team took inspiration from our diverse
          wildlife. Different animals play different roles – just like in
          nature.
        </p>
      </motion.div>

      {/* Block 5: Vertical spacing + full-width divider line 3-5.svg */}
      <div className='transparent-gap' aria-hidden='true' />

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
    </section>
  );
}
