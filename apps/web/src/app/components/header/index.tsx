import { buttonVariants } from '@heroui/react';
import { motion } from 'framer-motion';
import { Mail } from 'lucide-react';
import BlurEffect from 'react-progressive-blur';
import { useHeaderContrast } from '../../hooks/useHeaderContrast';
import { useLowPerfDevice } from '../../hooks/useLowPerfDevice';
import { tapScale } from '../../lib/motion';
import { ThemeToggle } from '../themeToggle';
import './index.scss';

const HEADER_HEIGHT = 100; // px — must match the CSS height below

export function Header() {
  const isLowPerfDevice = useLowPerfDevice();
  const contrast = useHeaderContrast(HEADER_HEIGHT + 4);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <motion.header
      className={isLowPerfDevice ? 'no-blur' : undefined}
      data-bg={contrast}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* backdrop-filter is expensive to keep compositing on scroll — weak
      devices get a plain solid tint instead (see .no-blur). The dark/light tint
      is two pre-rendered layers crossfaded via opacity (see index.scss) rather
      than one layer whose gradient color is swapped, so the transition actually
      animates instead of popping. */}
      {!isLowPerfDevice && (
        <>
          <BlurEffect position='top' intensity={60} className='header-blur' />
          <div className='header-tint header-tint--dark' aria-hidden='true' />
          <div className='header-tint header-tint--light' aria-hidden='true' />
        </>
      )}

      <motion.button
        type='button'
        className='logo'
        data-cursor='block'
        whileHover={{ y: -2 }}
        whileTap={tapScale}
        onClick={scrollToTop}
      >
        <img src='/logo.svg' width={38} />
      </motion.button>

      <div className='actions'>
        {/* Email: use <a> styled with HeroUI button classes — Button doesn't support as="a" in v3 */}
        <motion.a
          data-cursor='block'
          className={buttonVariants({ variant: 'ghost', isIconOnly: true })}
          href='mailto:mkrotova444@gmail.com'
          aria-label='Email Maria'
          whileHover={{ y: -2 }}
          whileTap={tapScale}
        >
          <Mail size={18} />
        </motion.a>
        <ThemeToggle />
      </div>
    </motion.header>
  );
}
