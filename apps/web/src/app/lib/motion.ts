import { Transition, Variants } from 'framer-motion';

export const easeOut: Transition['ease'] = [0.16, 1, 0.3, 1];

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.6, ease: easeOut }
  }
};

// Every slide-entrance variant is a plain fade now — kept as a separate name
// (rather than replacing every `fadeUp` call site with `fadeIn`) so a slide-up
// motion can come back later without touching every slide again.
export const fadeUp: Variants = fadeIn;

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.05 }
  }
};

export const viewportOnce = { once: true, margin: '-80px' };

export const tapScale = { scale: 0.96 };
