import { defineConfig } from 'vite';

// GitHub Pages serves this site from /icemachine/, so built files must
// point there. Local dev (npm run dev) still runs at the root.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/icemachine/' : '/',
}));
