import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    port: 2979,
    strictPort: true,
    proxy: {
      // Proxy image requests to the img-engine service
      '/img': {
        target: 'http://localhost:2978',
        changeOrigin: true
      },
      '/img-manifest': {
        target: 'http://localhost:2978',
        changeOrigin: true
      }
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `
          @use "@/medias" as *;
        `
      }
    }
  },
  plugins: [tailwindcss(), react()],
  build: {
    outDir: process.env.BUILD_OUTPUT_PATH || 'dist'
  }
});
