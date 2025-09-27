import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const resolvePath = (...segments: string[]) =>
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), ...segments);

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@accessmate/diagnostics': resolvePath('../../libs/diagnostics/src/index.ts'),
      '@accessmate/github': resolvePath('../../libs/github/src/index.ts'),
    },
  },
});
