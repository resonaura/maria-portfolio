import { CSSProperties, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { fadeUp, viewportOnce } from '../../lib/motion';

import './index.scss';

export interface ISlide {
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}

export function Slide(props: ISlide) {
  return (
    <motion.section
      style={props.style}
      className={'slide' + (props.className ? ' ' + props.className : '')}
      variants={fadeUp}
      initial='hidden'
      whileInView='visible'
      viewport={viewportOnce}
    >
      {props.children}
    </motion.section>
  );
}
