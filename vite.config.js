import { defineConfig } from 'vite';

// GitHub Pages serves this site from /icemachine/, so built files must
// point there. Local dev (npm run dev) still runs at the root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/icemachine/' : '/',
  // Issue #16: each published build gets its own id, so the high score table
  // starts fresh with every new build (PO decision, October 29).
  define: {
    __BUILD_ID__: JSON.stringify(command === 'build' ? String(Date.now()) : 'dev'),
  },
}));
