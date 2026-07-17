import { Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@heroui/react';
import { Slide } from '../../components/slide';
import { skills } from '../../../content/skills';
import { tapScale, viewportOnce } from '../../lib/motion';

import './index.scss';

const MotionButton = motion.create(Button);

export function AboutSlide() {
  return (
    <Slide className={'about-slide'}>
      <div className='slide-content'>
        <h2>About me</h2>

        <p>
          Hey, my name is Maria Kharitonova and I'm a{' '}
          <strong>graphic designer</strong> and an <strong>illustrator</strong>{' '}
          with 3+ years of experience. I endeavored in some forms of art or
          creativity since I was a child. Even then, I knew that it is my
          calling. As long as I can remember myself, I was always drawing
          something on notebook margins, the pavement and even clothes.
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

        <div className='skills'>
          {skills.map((skill) => {
            const Icon = skill.icon;
            return (
              <div className='skill' key={skill.name}>
                <div className='skill-label'>
                  <Icon size={16} />
                  <span>{skill.name}</span>
                </div>
                <div className='skill-bar'>
                  <motion.div
                    className='skill-bar-fill'
                    initial={{ width: 0 }}
                    whileInView={{ width: `${skill.level}%` }}
                    viewport={viewportOnce}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className='actions'>
          <MotionButton
            variant='outline'
            data-cursor='block'
            href='mailto:mkrotova444@gmail.com'
            whileHover={{ y: -3 }}
            whileTap={tapScale}
          >
            <Mail size={16} />
            Contact me
          </MotionButton>
        </div>
      </div>
    </Slide>
  );
}

