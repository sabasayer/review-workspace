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

  it('attaches related Annotation context for a same-Target match on every Target type', () => {
    const comments: Comment[] = [
      {
        id: 'cr-file',
        createdAt: '2026-08-01T09:00:00.000Z',
        body: 'File comment.',
        target: { type: 'file', path: 'src/a.ts' },
        kind: 'change-request',
        status: 'open',
        resolved: false,
      },
      {
        id: 'cr-hunk',
        createdAt: '2026-08-01T09:01:00.000Z',
        body: 'Hunk comment.',
        target: { type: 'hunk', path: 'src/b.ts', hunkIndex: 3 },
        kind: 'change-request',
        status: 'open',
        resolved: false,
      },
      {
        id: 'cr-line',
        createdAt: '2026-08-01T09:02:00.000Z',
        body: 'Line comment.',
        target: { type: 'line', side: 'base', line: 7, expectedText: 'return x', path: 'src/c.ts' },
        kind: 'change-request',
        status: 'open',
        resolved: false,
      },
      {
        id: 'cr-binary',
        createdAt: '2026-08-01T09:03:00.000Z',
        body: 'Binary comment.',
        target: { type: 'binary', path: 'src/d.png' },
        kind: 'change-request',
        status: 'open',
        resolved: false,
      },
    ]

    const annotations: Annotation[] = [
      { id: 'an-file', target: { type: 'file', path: 'src/a.ts' }, summary: 'File Annotation.' },
      { id: 'an-hunk', target: { type: 'hunk', path: 'src/b.ts', hunkIndex: 3 }, summary: 'Hunk Annotation.' },
      {
        id: 'an-line',
        target: { type: 'line', side: 'base', line: 7, expectedText: 'return x', path: 'src/c.ts' },
        summary: 'Line Annotation.',
      },
      { id: 'an-binary', target: { type: 'binary', path: 'src/d.png' }, summary: 'Binary Annotation.' },
    ]

    const markdown = buildHandoffMarkdown({
      bundlePath: 'fixtures/bundles/valid',
      comparison,
      round: 3,
      comments,
      annotations,
    })

    expect(markdown).toBe(
      [
        '# Change requests — round 3',
        '',
        '<!--',
        'review-workspace-handoff',
        `bundlePath: ${resolve('fixtures/bundles/valid')}`,
        'repository: example/widgets',
        'mrNumber: 42',
        'round: 3',
        '-->',
        '',
        '## src/a.ts',
        '',
        '### File: src/a.ts',
        '',
        'File comment.',
        '',
        '**Annotation (note):** File Annotation.',
        '',
        '---',
        '',
        '## src/b.ts',
        '',
        '### Hunk #3 in src/b.ts',
        '',
        'Hunk comment.',
        '',
        '**Annotation (note):** Hunk Annotation.',
        '',
        '---',
        '',
        '## src/c.ts',
        '',
        '### Line 7 (base) in src/c.ts',
        '> return x',
        '',
        'Line comment.',
        '',
        '**Annotation (note):** Line Annotation.',
        '',
        '---',
        '',
        '## src/d.png',
        '',
        '### Binary change: src/d.png',
        '',
        'Binary comment.',
        '',
        '**Annotation (note):** Binary Annotation.',
        '',
        '---',
        '',
      ].join('\n'),
    )
  })

  it('does not attach a hunk-level Annotation to a file-level comment on the same file — cross-granularity matching is out of scope', () => {
    const comments: Comment[] = [
      {
        id: 'cr-file',
        createdAt: '2026-08-01T09:00:00.000Z',
        body: 'File comment.',
        target: { type: 'file', path: 'src/a.ts' },
        kind: 'change-request',
        status: 'open',
        resolved: false,
      },
    ]

    const annotations: Annotation[] = [
      { id: 'an-hunk', target: { type: 'hunk', path: 'src/a.ts', hunkIndex: 0 }, summary: 'Hunk Annotation on same file.' },
    ]

    const markdown = buildHandoffMarkdown({
      bundlePath: 'fixtures/bundles/valid',
      comparison,
      round: 4,
      comments,
      annotations,
    })

    expect(markdown).toBe(
      [
        '# Change requests — round 4',
        '',
        '<!--',
        'review-workspace-handoff',
        `bundlePath: ${resolve('fixtures/bundles/valid')}`,
        'repository: example/widgets',
        'mrNumber: 42',
        'round: 4',
        '-->',
        '',
        '## src/a.ts',
        '',
        '### File: src/a.ts',
        '',
        'File comment.',
        '',
        '---',
        '',
      ].join('\n'),
    )
  })
})
