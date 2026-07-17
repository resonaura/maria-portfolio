import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  server: {
    port: 5600,
    strictPort: true
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
