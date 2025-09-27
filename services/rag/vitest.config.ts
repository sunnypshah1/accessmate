import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@accessmate/diagnostics': resolve(__dirname, '../../libs/diagnostics/src/index.ts'),
      '@accessmate/wcag': resolve(__dirname, '../../libs/wcag/src/index.ts'),
      '@accessmate/db': resolve(__dirname, './test/db-stub.ts'),
    },
  },
});
