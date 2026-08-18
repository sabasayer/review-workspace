import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { writeHandoffResponse, type HandoffResponseEntry } from './write-handoff-response.ts'

let workDir: string
let feedbackDir: string

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'review-workspace-write-handoff-response-'))
  feedbackDir = join(workDir, '.review-feedback')
  mkdirSync(feedbackDir)
})

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true })
})

describe('writeHandoffResponse', () => {
  it('writes the response file next to the hand-off file, named by mr number and round', () => {
    const responses: HandoffResponseEntry[] = [
      { commentId: 'cr-1', status: 'addressed', whatIChanged: 'Copied the config object before mutating it.' },
      { commentId: 'cr-2', status: 'skipped', reason: 'Needs a design-spec answer first.' },
    ]

    const filePath = writeHandoffResponse({
      handoffFilePath: join(feedbackDir, '42-round3.md'),
      mrNumber: '42',
      round: 3,
      responses,
    })

    expect(filePath).toBe(join(feedbackDir, '42-round3.response.json'))
    expect(JSON.parse(readFileSync(filePath, 'utf-8'))).toEqual(responses)
    expect(readFileSync(filePath, 'utf-8')).toBe(JSON.stringify(responses, null, 2) + '\n')
  })

  it('writes an empty array when every comment was skipped or none were provided', () => {
    const filePath = writeHandoffResponse({
      handoffFilePath: join(feedbackDir, '7-round1.md'),
      mrNumber: '7',
      round: 1,
      responses: [],
    })

    expect(JSON.parse(readFileSync(filePath, 'utf-8'))).toEqual([])
  })
})
