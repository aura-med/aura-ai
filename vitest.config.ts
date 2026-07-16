import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      'server-only': path.resolve(__dirname, '__mocks__/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['lib/**/*.test.ts'],
  },
})
