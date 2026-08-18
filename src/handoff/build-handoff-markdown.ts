import { resolve } from 'node:path'
import type { Comment } from '../questions/types.ts'
import type { Annotation, Comparison, Target } from '../schema/types.ts'

export interface HandoffMarkdownInput {
  bundlePath: string
  comparison: Comparison
  round: number
  comments: Comment[]
  annotations: Annotation[]
}

const GENERAL_GROUP = '(general — no Target)'

function targetPath(target: Target): string {
  return target.path
}

function targetKey(target: Target): string {
  switch (target.type) {
    case 'file':
      return `file:${target.path}`
    case 'binary':
      return `binary:${target.path}`
    case 'hunk':
      return `hunk:${target.path}:${target.hunkIndex}`
    case 'line':
      return `line:${target.path}:${target.side}:${target.line}`
  }
}

// Same-type-same-Target only: a file-level comment does not pick up
// hunk-level Annotations on that file (or vice versa). Cross-granularity
// matching is a coarser question ("does this Annotation touch material this
// comment also concerns?") that issue #10 doesn't ask for — it wants the
// Annotation the comment was raised against, i.e. the same Target.
function targetsEqual(a: Target, b: Target): boolean {
  return targetKey(a) === targetKey(b)
}

function describeTarget(target: Target): string {
  switch (target.type) {
    case 'file':
      return `File: ${target.path}`
    case 'hunk':
      return `Hunk #${target.hunkIndex} in ${target.path}`
    case 'line':
      return `Line ${target.line} (${target.side}) in ${target.path}`
    case 'binary':
      return `Binary change: ${target.path}`
  }
}

function openChangeRequests(comments: Comment[]): Comment[] {
  return comments.filter((c) => c.kind === 'change-request' && c.status === 'open' && !c.resolved)
}

function groupByFile(comments: Comment[]): Map<string, Comment[]> {
  const byFile = new Map<string, Comment[]>()
  for (const comment of comments) {
    const key = comment.target ? targetPath(comment.target) : GENERAL_GROUP
    const group = byFile.get(key) ?? []
    group.push(comment)
    byFile.set(key, group)
  }
  return byFile
}

function orderedFileKeys(byFile: Map<string, Comment[]>): string[] {
  return [...byFile.keys()].sort((a, b) => {
    if (a === GENERAL_GROUP) return 1
    if (b === GENERAL_GROUP) return -1
    return a.localeCompare(b)
  })
}

function metadataBlock(input: HandoffMarkdownInput): string[] {
  return [
    '<!--',
    'review-workspace-handoff',
    `bundlePath: ${resolve(input.bundlePath)}`,
    `repository: ${input.comparison.repository ?? ''}`,
    `mrNumber: ${input.comparison.number ?? ''}`,
    `round: ${input.round}`,
    '-->',
  ]
}

/**
 * Builds the hand-off Markdown a separate implementer-side skill parses.
 * Content is raw: every open change-request Comment verbatim, grouped by
 * file, with its exact Target and any Annotation raised against that same
 * Target for context. This exact shape is a parsed contract — golden-tested,
 * do not reformat without updating that consumer too.
 */
export function buildHandoffMarkdown(input: HandoffMarkdownInput): string {
  const comments = openChangeRequests(input.comments)

  const lines: string[] = [`# Change requests — round ${input.round}`, '', ...metadataBlock(input), '']

  if (comments.length === 0) {
    lines.push('_No open change-request comments._')
    return lines.join('\n') + '\n'
  }

  const byFile = groupByFile(comments)
  for (const file of orderedFileKeys(byFile)) {
    lines.push(`## ${file}`)
    lines.push('')

    const fileComments = [...(byFile.get(file) ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    for (const comment of fileComments) {
      lines.push(comment.target ? `### ${describeTarget(comment.target)}` : '### (no Target)')
      if (comment.target?.type === 'line') {
        lines.push(`> ${comment.target.expectedText}`)
      }
      lines.push('')
      lines.push(comment.body)
      lines.push('')

      const relatedAnnotations = comment.target
        ? input.annotations.filter((a) => targetsEqual(a.target, comment.target!))
        : []
      for (const annotation of relatedAnnotations) {
        lines.push(`**Annotation (${annotation.kind ?? 'note'}):** ${annotation.summary}`)
        lines.push('')
      }

      lines.push('---')
      lines.push('')
    }
  }

  return lines.join('\n').replace(/\n{2,}$/, '\n')
}
