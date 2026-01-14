import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
    process.env.ANALYZE === '1' && visualizer({
      open: false,
      gzipSize: true,
      brotliSize: true,
      filename: "dist/stats.html"
    }),
  ],
  define: {
    // This solves the 'global is not defined' error in Stacks.js
    global: 'globalThis',
  },
  resolve: {
    alias: {
      // Some versions of stacks.js require explicit buffer mapping
      buffer: 'buffer',
    },
  },
  optimizeDeps: {
    // This forces Vite to pre-bundle these correctly
    include: [
      '@stacks/connect',
      '@stacks/transactions',
      '@stacks/network',
      '@stacks/common',
      'bs58'
    ],
  },
  build: {
    commonjsOptions: {
      // This is the specific fix for the bs58 / "default export" error
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks: {
          'stacks-core': ['@stacks/connect', '@stacks/network', '@stacks/common'],
          'stacks-tx': ['@stacks/transactions'],
          vendor: ['buffer', 'js-sha256'],
        },
      },
    },
  },
});