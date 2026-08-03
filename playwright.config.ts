import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const root = fileURLToPath(new URL('.', import.meta.url))
const enrichedPort = 4318

export default defineConfig({
  testDir: join(root, 'e2e'),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}{ext}',
  use: {
    baseURL: `http://127.0.0.1:${enrichedPort}`,
    viewport: { width: 1280, height: 800 },
    colorScheme: 'light',
    locale: 'en-US',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm build:ui && node src/cli.ts serve fixtures/bundles/enriched --port ${enrichedPort}`,
    url: `http://127.0.0.1:${enrichedPort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    cwd: root,
  },
})
