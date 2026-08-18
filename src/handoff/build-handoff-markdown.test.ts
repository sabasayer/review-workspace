import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Comment } from '../questions/types.ts'
import type { Annotation, Comparison } from '../schema/types.ts'
import { buildHandoffMarkdown } from './build-handoff-markdown.ts'

const comparison: Comparison = {
  base: 'aaa1111',
  head: 'bbb2222',
  repository: 'example/widgets',
  number: '42',
}

describe('buildHandoffMarkdown', () => {
  it('renders no open change-requests as an explicit empty state, still carrying the metadata block', () => {
    const markdown = buildHandoffMarkdown({
      bundlePath: 'fixtures/bundles/valid',
      comparison,
      round: 1,
      comments: [],
      annotations: [],
    })

    expect(markdown).toBe(
      [
        '# Change requests — round 1',
        '',
        '<!--',
        'review-workspace-handoff',
        `bundlePath: ${resolve('fixtures/bundles/valid')}`,
        'repository: example/widgets',
        'mrNumber: 42',
        'round: 1',
        '-->',
        '',
        '_No open change-request comments._',
        '',
      ].join('\n'),
    )
  })

  it('produces the exact golden Markdown for a mixed set of comments, groupings, and Annotation context (contract another skill parses)', () => {
    const comments: Comment[] = [
      {
        id: 'cr-1',
        createdAt: '2026-08-01T10:00:00.000Z',
        body: 'This mutates the shared config object in place — please copy it first.',
        target: { type: 'line', side: 'head', line: 42, expectedText: 'config.timeout = 30', path: 'src/config.ts' },
        kind: 'change-request',
        status: 'open',
        resolved: false,
      },
      {
        id: 'cr-2',
        createdAt: '2026-08-01T09:00:00.000Z',
        body: 'This hunk removes the retry loop entirely — was that intentional?',
        target: { type: 'hunk', path: 'src/config.ts', hunkIndex: 1 },
        kind: 'change-request',
        status: 'open',
        resolved: false,
      },
      {
        id: 'cr-3',
        createdAt: '2026-08-01T11:00:00.000Z',
        body: 'This whole file needs a licence header.',
        target: { type: 'file', path: 'src/auth/login.ts' },
        kind: 'change-request',
        status: 'open',
        resolved: false,
      },
      {
        id: 'cr-4',
        createdAt: '2026-08-01T12:00:00.000Z',
        body: 'General note not tied to any specific Target.',
        kind: 'change-request',
        status: 'open',
        resolved: false,
      },
      {
        id: 'cr-resolved',
        createdAt: '2026-08-01T08:00:00.000Z',
        body: 'Already resolved — must not appear.',
        target: { type: 'file', path: 'src/auth/login.ts' },
        kind: 'change-request',
        status: 'open',
        resolved: true,
        resolvedAt: '2026-08-01T13:00:00.000Z',
      },
      {
        id: 'cr-withdrawn',
        createdAt: '2026-08-01T08:30:00.000Z',
        body: 'Withdrawn — must not appear.',
        target: { type: 'file', path: 'src/auth/login.ts' },
        kind: 'change-request',
        status: 'withdrawn',
        resolved: false,
      },
      {
        id: 'q-1',
        createdAt: '2026-08-01T08:45:00.000Z',
        body: 'A Question — must not appear.',
        target: { type: 'file', path: 'src/auth/login.ts' },
        kind: 'question',
        status: 'open',
        resolved: false,
      },
    ]

    const annotations: Annotation[] = [
      {
        id: 'an-1',
        target: { type: 'line', side: 'head', line: 42, expectedText: 'config.timeout = 30', path: 'src/config.ts' },
        summary: 'Sets the shared request timeout used by every downstream client.',
        kind: 'risk',
      },
      {
        id: 'an-2',
        target: { type: 'file', path: 'src/unrelated.ts' },
        summary: 'Unrelated Annotation — must not appear.',
      },
    ]

    const markdown = buildHandoffMarkdown({
      bundlePath: 'fixtures/bundles/valid',
      comparison,
      round: 2,
      comments,
      annotations,
    })

    expect(markdown).toBe(
      [
        '# Change requests — round 2',
        '',
        '<!--',
        'review-workspace-handoff',
        `bundlePath: ${resolve('fixtures/bundles/valid')}`,
        'repository: example/widgets',
        'mrNumber: 42',
        'round: 2',
        '-->',
        '',
        '## src/auth/login.ts',
        '',
        '### File: src/auth/login.ts',
        '',
        'This whole file needs a licence header.',
        '',
        '---',
        '',
        '## src/config.ts',
        '',
        '### Hunk #1 in src/config.ts',
        '',
        'This hunk removes the retry loop entirely — was that intentional?',
        '',
        '---',
        '',
        '### Line 42 (head) in src/config.ts',
        '> config.timeout = 30',
        '',
        'This mutates the shared config object in place — please copy it first.',
        '',
        '**Annotation (risk):** Sets the shared request timeout used by every downstream client.',
        '',
        '---',
        '',
        '## (general — no Target)',
        '',
        '### (no Target)',
        '',
        'General note not tied to any specific Target.',
        '',
        '---',
        '',
      ].join('\n'),
    )
  })
})
