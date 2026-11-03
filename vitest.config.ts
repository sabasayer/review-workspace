import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig } from 'vitest/config'

const backupRoot = mkdtempSync(join(tmpdir(), 'review-workspace-test-backups-'))

export default defineConfig({
  test: {
    env: { REVIEW_WORKSPACE_BACKUP_ROOT: backupRoot },
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
