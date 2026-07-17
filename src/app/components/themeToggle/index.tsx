import { Moon, Sun } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@heroui/react';
import { useTheme } from '../../providers/theme/context';
import { tapScale } from '../../lib/motion';
import './index.scss';

const MotionButton = motion.create(Button);

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <MotionButton
      isIconOnly
      variant='ghost'
      className='theme-toggle'
      data-cursor='block'
      aria-label='Toggle theme'
      whileTap={tapScale}
      onPress={toggleTheme}
    >
      <Sun className='icon icon-sun' size={20} />
      <Moon className='icon icon-moon' size={20} />
      <span className='sr-only'>
        Switch to {theme === 'dark' ? 'light' : 'dark'} theme
      </span>
    </MotionButton>
  );
}

