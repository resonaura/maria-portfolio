import { Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import { buttonVariants } from '@heroui/react';
import BlurEffect from 'react-progressive-blur';
import { ThemeToggle } from '../themeToggle';
import { tapScale } from '../../lib/motion';
import { useLowPerfDevice } from '../../hooks/useLowPerfDevice';
import './index.scss';

export function Header() {
  const isLowPerfDevice = useLowPerfDevice();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <motion.header
      className={isLowPerfDevice ? 'no-blur' : undefined}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* backdrop-filter is expensive to keep compositing on scroll — weak
      devices get a plain solid tint instead (see .no-blur) */}
      {!isLowPerfDevice && (
        <BlurEffect position='top' intensity={60} className='header-blur' />
      )}

      <motion.button
        type='button'
        className='logo'
        data-cursor='block'
        whileHover={{ y: -2 }}
        whileTap={tapScale}
        onClick={scrollToTop}
      >
        Maria
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
