import { Button } from '@heroui/react';
import { motion, Variants } from 'framer-motion';
import { Mail } from 'lucide-react';
import { skills } from '../../../content/skills';
import { Slide } from '../../components/slide';
import {
  easeOut,
  staggerContainer,
  tapScale,
  viewportOnce
} from '../../lib/motion';

import './index.scss';

const MotionButton = motion.create(Button);

export function AboutSlide() {
  return (
    <Slide className={'about-slide'}>
      <div className='slide-content'>
        <h2>About me</h2>

        <p>
          Hey, my name is Maria Kharitonova and I'm a{' '}
          <strong>graphic designer</strong> and an <strong>illustrator</strong>.
          I endeavored in some forms of art or creativity since I was a child.
          Even then, I knew that it is my calling. As long as I can remember
          myself, I was always drawing something on notebook margins, the
          pavement and even clothes.
        </p>

        <p>
          Eventually, in the process of following my passion, I ended up knowing
          how to create designs for said notebook covers, clothes prints and
          even graffiti for pavements. I am truly happy when I see posters,
          leaflets, flyers and other printed products with my illustrations. The
          thought of making the world around me more bright and engaging excites
          me.
        </p>

        <p>
          I believe graphic design is a form of art. It is evident from the
          style of my portfolio that I'm inspired by many authors from Asia, but
          I try to synthesize my designs from various different cultural
          movements, creating eclectic and unique looks.
        </p>

        <motion.div
          className='skills'
          variants={staggerContainer}
          initial='hidden'
          whileInView='visible'
          viewport={viewportOnce}
        >
          {skills.map((skill) => {
            const Icon = skill.icon;
            // Per-skill width target, so each bar needs its own variants object —
            // still driven by the single observer on .skills above rather than one
            // whileInView per bar (four simultaneous IntersectionObservers mounting
            // at once was flaky in Safari, firing maybe half the time).
            const barVariants: Variants = {
              hidden: { width: 0 },
              visible: {
                width: `${skill.level}%`,
                transition: { duration: 0.8, ease: easeOut }
              }
            };
            return (
              <div className='skill' key={skill.name}>
                <div className='skill-label'>
                  <Icon size={16} />
                  <span>{skill.name}</span>
                </div>
                <div className='skill-bar'>
                  <motion.div
                    className='skill-bar-fill'
                    variants={barVariants}
                  />
                </div>
              </div>
            );
          })}
        </motion.div>

        <div className='actions'>
          <a
            href='mailto:mkrotova444@gmail.com'
            style={{ textDecoration: 'none' }}
          >
            <MotionButton
              variant='outline'
              data-cursor='block'
              whileHover={{ y: -3 }}
              whileTap={tapScale}
            >
              <Mail size={16} />
              Contact me
            </MotionButton>
          </a>
        </div>
      </div>
    </Slide>
  );
}
