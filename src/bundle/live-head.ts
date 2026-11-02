import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const LIVE_HEAD_FILE = 'live-head.json'

export interface LiveHead {
  head: string
  checkedAt: string
}

export type LiveHeadRead =
  | { status: 'absent' }
  | { status: 'invalid'; message: string }
  | { status: 'ok'; liveHead: LiveHead }

export interface Staleness {
  stale: boolean
  round: number
}

export type LiveHeadStatus = Staleness & { recordedHead: string } & LiveHeadRead

function parseLiveHead(value: unknown): LiveHead | string {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return `${LIVE_HEAD_FILE} must be a JSON object`
  const { head, checkedAt } = value as Record<string, unknown>
  if (typeof head !== 'string' || head === '') return 'head must be a non-empty string'
  if (typeof checkedAt !== 'string' || Number.isNaN(Date.parse(checkedAt))) return 'checkedAt must be an ISO date string'
  return { head, checkedAt }
}

export function readLiveHead(bundlePath: string): LiveHeadRead {
  const path = join(bundlePath, LIVE_HEAD_FILE)
  if (!existsSync(path)) return { status: 'absent' }

  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf-8'))
  } catch (err) {
    return { status: 'invalid', message: `${LIVE_HEAD_FILE} is not valid JSON: ${(err as Error).message}` }
  }

  const parsed = parseLiveHead(raw)
  return typeof parsed === 'string' ? { status: 'invalid', message: parsed } : { status: 'ok', liveHead: parsed }
}

export function bundleStaleness(comparisonHead: string, liveHead: LiveHead | undefined, round: number): Staleness {
  return { stale: liveHead !== undefined && liveHead.head !== comparisonHead, round }
}

export function buildLiveHeadStatus(read: LiveHeadRead, comparisonHead: string, round: number): LiveHeadStatus {
  const liveHead = read.status === 'ok' ? read.liveHead : undefined
  return { ...read, recordedHead: comparisonHead, ...bundleStaleness(comparisonHead, liveHead, round) }
}
