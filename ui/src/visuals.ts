import type { IntentVisual } from './types.ts'

export const MAX_SHOWN_VISUALS = 3

export interface VisualSelection {
  shown: IntentVisual[]
  more: IntentVisual[]
}

export function selectVisuals(visuals: readonly IntentVisual[] | undefined): VisualSelection {
  const ordered = [
    ...(visuals ?? []).filter((v) => v.source === 'mr-text'),
    ...(visuals ?? []).filter((v) => v.source !== 'mr-text'),
  ]
  return { shown: ordered.slice(0, MAX_SHOWN_VISUALS), more: ordered.slice(MAX_SHOWN_VISUALS) }
}
