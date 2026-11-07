import { defineConfig } from 'vite';

export default defineConfig({
  base: './', // Ensures relative asset paths so it runs cleanly on any domain, subfolder, Netlify, or GitHub Pages
  server: {
    port: 3000,
    host: '127.0.0.1'
  },
  preview: {
    port: 3000,
    host: '127.0.0.1'
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true
  }
});
