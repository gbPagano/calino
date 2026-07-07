import { readFileSync, existsSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { configDefaults } from 'vitest/config'
import { caldavMockPlugin } from './e2e/fixtures/vite-caldav-mock'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'))

// Load self-hosted config at build time (baked into bundle, not served as separate file)
const configPath = new URL('./calino.config.json', import.meta.url)
let calinoConfig: Record<string, unknown> | null = null
if (existsSync(configPath)) {
  try {
    calinoConfig = JSON.parse(readFileSync(configPath, 'utf-8'))
    const accountCount = Array.isArray(calinoConfig?.accounts) ? calinoConfig.accounts.length : 0
    console.log('[build] Loaded calino.config.json —', accountCount, 'account(s)')
  } catch (e) {
    console.warn('[build] Failed to parse calino.config.json:', e)
  }
}

export default defineConfig({
  base: '/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __CALINO_CONFIG__: JSON.stringify(calinoConfig),
    __CALINO_SELF_HOSTED__: JSON.stringify(!!calinoConfig || process.env.CALINO_SELF_HOSTED === 'true'),
  },
  plugins: [react(), nodePolyfills(), caldavMockPlugin()],
  server: {
    // SECURITY: default to localhost-only. The dev server has known
    // WebSocket arbitrary file read CVEs (CVE-2026-39363, see
    // GHSA-p9ff-h696-f583) — binding to 0.0.0.0 means anyone on the
    // local network can read source files via the dev WebSocket. Set
    // CALINO_DEV_HOST=0.0.0.0 only when you actually need LAN access
    // (e.g. testing on a phone).
    host: process.env.CALINO_DEV_HOST ?? 'localhost',
    allowedHosts: ['jankyboi', 'localhost'],
    hmr: {
      host: process.env.CALINO_DEV_HOST ?? 'localhost',
      port: 8080,
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
    // e2e/ is for Playwright tests, not vitest — keep them out of `pnpm test`.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
