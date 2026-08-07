import path from 'node:path'
import { defineConfig } from 'vitest/config'

// Standalone Vitest config kept separate from vite.config.ts so unit tests do
// not pull in the app's build plugins (React/Tailwind/PWA). Tests are pure
// logic and run in the Node environment. The `@` alias mirrors vite.config.ts
// so feature modules that import `@/...` resolve under test.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
