import React from 'react';
import ReactDOM from 'react-dom/client';
import { ImgManifestProvider } from '@maria-portfolio/img-client';

import App from './app/index.tsx';

import './heroui.css';
import './theme.scss';

declare global {
  interface Window {
    /** Tells index.html's fake-progress loop (see boot-timer script) to stop —
     * checked so it can't race the "100%" write below on the next frame. */
    __bootDone?: boolean;
  }
}

function mount() {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ImgManifestProvider>
        <App />
      </ImgManifestProvider>
    </React.StrictMode>
  );
}

// Stop the boot shell's fake-progress loop and show a definitive 100% for one
// painted frame before the real app replaces #root's contents — otherwise it
// would just vanish at whatever arbitrary percentage the easing curve was at.
// The double rAF matters: the first only guarantees the "100%" write lands
// before *a* repaint, the second defers the actual mount to the frame after
// that, so "100%" gets its own paint instead of being swapped out same-frame.
window.__bootDone = true;
const bootTimer = document.getElementById('boot-timer');
if (bootTimer) bootTimer.textContent = '100%';

requestAnimationFrame(() => requestAnimationFrame(mount));

