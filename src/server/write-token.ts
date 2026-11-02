import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'

export const WRITE_TOKEN_FILE = '.write-token'

export interface LoadWriteTokenOptions {
  rotate?: boolean
}

export function generateWriteToken(): string {
  return randomBytes(24).toString('hex')
}

/**
 * Returns the bundle's write token, minting and saving one on first use. The token
 * lives in the bundle so a restart keeps every link and token already handed out
 * valid. The file is local to this machine: .gitignore and the package `files`
 * list keep it out of git and out of a published package.
 */
export function loadWriteToken(bundlePath: string, options: LoadWriteTokenOptions = {}): string {
  const path = join(bundlePath, WRITE_TOKEN_FILE)
  if (!options.rotate && existsSync(path)) {
    const saved = readFileSync(path, 'utf-8').trim()
    if (saved !== '') {
      chmodSync(path, 0o600)
      return saved
    }
  }
  const token = generateWriteToken()
  writeFileSync(path, token + '\n', { mode: 0o600 })
  chmodSync(path, 0o600)
  return token
}
