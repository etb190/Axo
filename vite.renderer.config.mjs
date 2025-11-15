// vite.renderer.config.mjs
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [
    nodePolyfills({
      // Enable Node.js globals like `require`, `module`, and `exports`
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // Include specific Node.js modules
      include: ['fs', 'path'],
    }),
  ],
  // Ensure Node.js modules are resolved correctly
  resolve: {
    alias: {
      // Map Node.js built-in modules to their polyfilled versions
      fs: 'vite-plugin-node-polyfills/shims/fs',
      path: 'vite-plugin-node-polyfills/shims/path',
    },
  },
  // Optimize for Electron's renderer process
  optimizeDeps: {
    esbuildOptions: {
      target: 'esnext',
    },
  },
});