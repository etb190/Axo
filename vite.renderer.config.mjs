import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vitejs.dev/config
export default defineConfig({
  base: './',
  plugins: [
    react(),
    nodePolyfills({
      // Enable Node.js globals like `require`, `module`, and `exports`
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // Include specific Node.js modules
      include: ['events', 'stream', 'buffer', 'util'],
    }),
  ],
  // Standard Electron resolution
  resolve: {
    alias: {
      // Avoid manual shims unless necessary
    },
  },
  optimizeDeps: {
    // Remove force: true to avoid race conditions with Electron start
    // Exclude problematic or unnecessary large dependencies from optimization
    exclude: ['electron'],
  },
  build: {
    rollupOptions: {
      external: ['electron'],
    },
  },
});