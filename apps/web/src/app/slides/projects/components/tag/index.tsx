import { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import './index.scss';

type TagStyle = CSSProperties & { '--light'?: string };

export interface ITag {
  icon?: LucideIcon;
  light?: string;
  title: string;
}

export function Tag({ icon: Icon, light, title }: ITag) {
  const style: TagStyle = { '--light': light };

  return (
    <motion.div
      className='tag'
      data-cursor='block'
      style={style}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      {Icon && <Icon size={14} />}
      <span className='title' aria-hidden='true'>
        {title}
      </span>
    </motion.div>
  );
}
