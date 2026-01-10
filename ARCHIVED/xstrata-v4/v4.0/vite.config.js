import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

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
  },
});