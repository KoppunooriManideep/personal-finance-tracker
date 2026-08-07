import { defineConfig } from 'vitest/config'

// Standalone Vitest config kept separate from vite.config.ts so unit tests do
// not pull in the app's build plugins (React/Tailwind/PWA). Tests are pure
// logic and run in the Node environment.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
