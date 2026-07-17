import React from 'react';
import ReactDOM from 'react-dom/client';
import { ImgManifestProvider } from '@maria-portfolio/img-client';

import App from './app/index.tsx';

import './heroui.css';
import './theme.scss';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ImgManifestProvider>
      <App />
    </ImgManifestProvider>
  </React.StrictMode>
);


