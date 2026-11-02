import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const WATCHER_FILE = 'watcher.json'

export interface WatcherState {
  enabled: boolean
  cap: number
  used: number
  /** Id of the Question the watcher is answering now, or null. */
  current: string | null
}

export type WatcherRead =
  | { status: 'absent' }
  | { status: 'invalid'; message: string }
  | { status: 'ok'; watcher: WatcherState }

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

function parseWatcher(value: unknown): WatcherState | string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return `${WATCHER_FILE} must be a JSON object`
  const { enabled, cap, used, current = null } = value as Record<string, unknown>
  if (typeof enabled !== 'boolean') return 'enabled must be true or false'
  if (!isCount(cap)) return 'cap must be a whole number of 0 or more'
  if (!isCount(used)) return 'used must be a whole number of 0 or more'
  if (current !== null && typeof current !== 'string') return 'current must be a Question id or null'
  return { enabled, cap, used, current }
}

export function readWatcher(bundlePath: string): WatcherRead {
  const path = join(bundlePath, WATCHER_FILE)
  if (!existsSync(path)) return { status: 'absent' }

  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf-8'))
  } catch (err) {
    return { status: 'invalid', message: `${WATCHER_FILE} is not valid JSON: ${(err as Error).message}` }
  }

  const parsed = parseWatcher(raw)
  return typeof parsed === 'string' ? { status: 'invalid', message: parsed } : { status: 'ok', watcher: parsed }
}
