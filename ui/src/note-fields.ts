import type { Annotation, CodeTarget } from './types.ts'

type BadgeColor = 'success' | 'warning' | 'error' | 'info' | 'neutral'
type Verdict = NonNullable<Annotation['verdict']>
type Severity = NonNullable<Annotation['severity']>
type Source = NonNullable<Annotation['source']>

const VERDICT_LABELS: Record<Verdict, string> = {
  intended: 'Intended',
  missing: 'Missing',
  wrong: 'Wrong',
  extra: 'Extra',
  unclear: 'Unclear',
}

const VERDICT_COLORS: Record<Verdict, BadgeColor> = {
  intended: 'success',
  missing: 'warning',
  wrong: 'error',
  extra: 'info',
  unclear: 'neutral',
}

const SEVERITY_COLORS: Record<Severity, BadgeColor> = { low: 'neutral', medium: 'warning', high: 'error' }

const SOURCE_LABELS: Record<Source, string> = {
  issue: 'the issue',
  'mr-text': 'the MR text',
  'repo-rule': 'a repo rule',
  nobody: 'nobody',
}

export function verdictLabel(verdict: Verdict): string {
  return VERDICT_LABELS[verdict]
}

export function verdictColor(verdict: Verdict): BadgeColor {
  return VERDICT_COLORS[verdict]
}

export function severityLabel(severity: Severity): string {
  return `${severity} severity`
}

export function severityColor(severity: Severity): BadgeColor {
  return SEVERITY_COLORS[severity]
}

export function sourceLabel(source: Source): string {
  return `asked by: ${SOURCE_LABELS[source]}`
}

export function lineLabel(target: CodeTarget): string | null {
  return target.type === 'line' ? `line ${target.line}` : null
}
