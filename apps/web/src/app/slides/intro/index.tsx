import { ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@heroui/react';
import { Slide } from '../../components/slide';
import { ThreeBackground } from '../../components/threeBackground';
import { tapScale } from '../../lib/motion';

import './index.scss';

const MotionButton = motion.create(Button);

export function IntroSlide() {
  const handleScrollTo = (targetId: string) => {
    const targetElement = document.querySelector('.' + targetId);
    if (targetElement) {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <Slide className={'intro-slide'}>
      {/* Three.js low-poly cityscape background — z-index 0, far layers CSS-blurred by depth */}
      <ThreeBackground />

      <div className='slide-content'>
        <p>Hi, my name is</p>
        <h1>Maria Kharitonova</h1>
        <h2>Graphic designer &amp; illustrator</h2>

        <div className='actions'>
          <MotionButton
            variant='primary'
            data-cursor='block'
            whileHover={{ y: -3 }}
            whileTap={tapScale}
            onPress={() => handleScrollTo('first-project-slide')}
          >
            See my work <ArrowRight size={16} />
          </MotionButton>
          <MotionButton
            variant='outline'
            data-cursor='block'
            whileHover={{ y: -3 }}
            whileTap={tapScale}
            onPress={() => handleScrollTo('about-slide')}
          >
            More about me <ArrowRight size={16} />
          </MotionButton>
        </div>
      </div>
    </Slide>
  );
}
