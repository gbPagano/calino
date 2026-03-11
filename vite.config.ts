/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  base: '/',
  plugins: [react(), nodePolyfills()],
  server: {
    host: '0.0.0.0',
    allowedHosts: ['jankyboi', 'localhost'],
    hmr: {
      host: '0.0.0.0',
      port: 5173,
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
