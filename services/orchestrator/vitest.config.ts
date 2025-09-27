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
      '@accessmate/core-types': resolvePath('../../libs/core-types/src/index.ts'),
      '@accessmate/diagnostics': resolvePath('../../libs/diagnostics/src/index.ts'),
      '@accessmate/dynamic-audit': resolvePath('../dynamic-audit/src/index.ts'),
      '@accessmate/persistence': resolvePath('../../libs/persistence/src/index.ts'),
      '@accessmate/queue': resolvePath('../../libs/queue/src/index.ts'),
      '@accessmate/scm': resolvePath('../scm/src/index.ts'),
    },
  },
});
