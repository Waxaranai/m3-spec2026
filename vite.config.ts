import { defineConfig } from 'vitest/config';

// Relative base keeps the build portable across GitHub Pages project sites,
// custom domains, and local previews.
export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
  },
  test: {
    server: {
      deps: {
        // MCU 0.4.0 ships some extensionless relative imports that Node's ESM
        // loader cannot resolve. Inline it so Vite's resolver handles it.
        inline: ['@material/material-color-utilities'],
      },
    },
  },
});
