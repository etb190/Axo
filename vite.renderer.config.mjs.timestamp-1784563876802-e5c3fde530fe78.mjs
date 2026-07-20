// vite.renderer.config.mjs
import { defineConfig } from "file:///C:/Users/PC/Desktop/Coding/Axo/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/PC/Desktop/Coding/Axo/node_modules/@vitejs/plugin-react/dist/index.js";
import { nodePolyfills } from "file:///C:/Users/PC/Desktop/Coding/Axo/node_modules/vite-plugin-node-polyfills/dist/index.js";
var vite_renderer_config_default = defineConfig({
  base: "./",
  plugins: [
    react(),
    nodePolyfills({
      // Enable Node.js globals like `require`, `module`, and `exports`
      globals: {
        Buffer: true,
        global: true,
        process: true
      },
      // Include specific Node.js modules
      include: ["events", "stream", "buffer", "util"]
    })
  ],
  // Standard Electron resolution
  resolve: {
    alias: {
      // Avoid manual shims unless necessary
    }
  },
  optimizeDeps: {
    // Remove force: true to avoid race conditions with Electron start
    // Exclude problematic or unnecessary large dependencies from optimization
    exclude: ["electron"]
  },
  build: {
    rollupOptions: {
      external: ["electron"]
    }
  }
});
export {
  vite_renderer_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5yZW5kZXJlci5jb25maWcubWpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcUENcXFxcRGVza3RvcFxcXFxDb2RpbmdcXFxcQXhvXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxQQ1xcXFxEZXNrdG9wXFxcXENvZGluZ1xcXFxBeG9cXFxcdml0ZS5yZW5kZXJlci5jb25maWcubWpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9QQy9EZXNrdG9wL0NvZGluZy9BeG8vdml0ZS5yZW5kZXJlci5jb25maWcubWpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSc7XHJcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCc7XHJcbmltcG9ydCB7IG5vZGVQb2x5ZmlsbHMgfSBmcm9tICd2aXRlLXBsdWdpbi1ub2RlLXBvbHlmaWxscyc7XHJcblxyXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgYmFzZTogJy4vJyxcclxuICBwbHVnaW5zOiBbXHJcbiAgICByZWFjdCgpLFxyXG4gICAgbm9kZVBvbHlmaWxscyh7XHJcbiAgICAgIC8vIEVuYWJsZSBOb2RlLmpzIGdsb2JhbHMgbGlrZSBgcmVxdWlyZWAsIGBtb2R1bGVgLCBhbmQgYGV4cG9ydHNgXHJcbiAgICAgIGdsb2JhbHM6IHtcclxuICAgICAgICBCdWZmZXI6IHRydWUsXHJcbiAgICAgICAgZ2xvYmFsOiB0cnVlLFxyXG4gICAgICAgIHByb2Nlc3M6IHRydWUsXHJcbiAgICAgIH0sXHJcbiAgICAgIC8vIEluY2x1ZGUgc3BlY2lmaWMgTm9kZS5qcyBtb2R1bGVzXHJcbiAgICAgIGluY2x1ZGU6IFsnZXZlbnRzJywgJ3N0cmVhbScsICdidWZmZXInLCAndXRpbCddLFxyXG4gICAgfSksXHJcbiAgXSxcclxuICAvLyBTdGFuZGFyZCBFbGVjdHJvbiByZXNvbHV0aW9uXHJcbiAgcmVzb2x2ZToge1xyXG4gICAgYWxpYXM6IHtcclxuICAgICAgLy8gQXZvaWQgbWFudWFsIHNoaW1zIHVubGVzcyBuZWNlc3NhcnlcclxuICAgIH0sXHJcbiAgfSxcclxuICBvcHRpbWl6ZURlcHM6IHtcclxuICAgIC8vIFJlbW92ZSBmb3JjZTogdHJ1ZSB0byBhdm9pZCByYWNlIGNvbmRpdGlvbnMgd2l0aCBFbGVjdHJvbiBzdGFydFxyXG4gICAgLy8gRXhjbHVkZSBwcm9ibGVtYXRpYyBvciB1bm5lY2Vzc2FyeSBsYXJnZSBkZXBlbmRlbmNpZXMgZnJvbSBvcHRpbWl6YXRpb25cclxuICAgIGV4Y2x1ZGU6IFsnZWxlY3Ryb24nXSxcclxuICB9LFxyXG4gIGJ1aWxkOiB7XHJcbiAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgIGV4dGVybmFsOiBbJ2VsZWN0cm9uJ10sXHJcbiAgICB9LFxyXG4gIH0sXHJcbn0pOyJdLAogICJtYXBwaW5ncyI6ICI7QUFBNFMsU0FBUyxvQkFBb0I7QUFDelUsT0FBTyxXQUFXO0FBQ2xCLFNBQVMscUJBQXFCO0FBRzlCLElBQU8sK0JBQVEsYUFBYTtBQUFBLEVBQzFCLE1BQU07QUFBQSxFQUNOLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOLGNBQWM7QUFBQTtBQUFBLE1BRVosU0FBUztBQUFBLFFBQ1AsUUFBUTtBQUFBLFFBQ1IsUUFBUTtBQUFBLFFBQ1IsU0FBUztBQUFBLE1BQ1g7QUFBQTtBQUFBLE1BRUEsU0FBUyxDQUFDLFVBQVUsVUFBVSxVQUFVLE1BQU07QUFBQSxJQUNoRCxDQUFDO0FBQUEsRUFDSDtBQUFBO0FBQUEsRUFFQSxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUE7QUFBQSxJQUVQO0FBQUEsRUFDRjtBQUFBLEVBQ0EsY0FBYztBQUFBO0FBQUE7QUFBQSxJQUdaLFNBQVMsQ0FBQyxVQUFVO0FBQUEsRUFDdEI7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLGVBQWU7QUFBQSxNQUNiLFVBQVUsQ0FBQyxVQUFVO0FBQUEsSUFDdkI7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
