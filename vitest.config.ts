import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'engine',
          include: ['src/**/*.test.ts'],
        },
      },
      {
        extends: true,
        root: './ui',
        test: {
          name: 'ui',
          include: ['src/**/*.test.ts'],
          environment: 'happy-dom',
        },
      },
    ],
  },
})
