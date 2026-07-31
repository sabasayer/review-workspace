import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { EMPTY_REVIEW_STATE, type ReviewState } from './types.ts'

function statePath(bundlePath: string): string {
  return join(bundlePath, 'state.json')
}

export function readReviewState(bundlePath: string): ReviewState {
  const path = statePath(bundlePath)
  if (!existsSync(path)) return structuredClone(EMPTY_REVIEW_STATE)
  return JSON.parse(readFileSync(path, 'utf-8')) as ReviewState
}

export function writeReviewState(bundlePath: string, state: ReviewState): void {
  writeFileSync(statePath(bundlePath), JSON.stringify(state, null, 2))
}
