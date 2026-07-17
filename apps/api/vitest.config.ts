import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC (not esbuild) is required so decorator metadata (emitDecoratorMetadata) is
// preserved for real Nest DI / TypeORM constructor-injection tests.
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
    globals: true,
    testTimeout: 20000
  },
  plugins: [swc.vite()]
});
