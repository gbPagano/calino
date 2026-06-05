import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Provide the compile-time constant for tests
if (typeof globalThis.__APP_VERSION__ === 'undefined') {
  // @ts-expect-error — setting compile-time constant for test environment
  globalThis.__APP_VERSION__ = '0.6.0'
}

const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  key: vi.fn(),
  length: 0,
}

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
})

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
})
