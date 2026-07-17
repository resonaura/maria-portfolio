import { IpadCursorConfig } from 'ipad-cursor';
import { IPadCursorProvider, useIPadCursor } from 'ipad-cursor/react';
import { ReactNode, useState } from 'react';
import { isMobileDevice } from '../../lib/device';

export const IpadProvider = ({ children }: { children: ReactNode }) => {
  const [isPhone] = useState(isMobileDevice);

  // Must stay above the fixed header (z-index: 10000) and its blur layer —
  // zIndex is per cursor-state style, not a top-level config key.
  const cursorZIndex = 10001;

  const config: IpadCursorConfig = {
    blockPadding: 'auto',
    normalStyle: {
      zIndex: cursorZIndex
    },
    textStyle: {
      zIndex: cursorZIndex
    },
    blockStyle: {
      radius: 'auto',
      zIndex: cursorZIndex
    },
    mouseDownStyle: {
      zIndex: cursorZIndex
    },
    enableAutoTextCursor: true
  };

  useIPadCursor();

  if (isPhone) return <>{children}</>;

  return <IPadCursorProvider config={config}>{children}</IPadCursorProvider>;
};
