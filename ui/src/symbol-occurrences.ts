import { openSymbolLookup } from './composables/symbol-lookup-store.ts'
import { currentFiles } from './composables/view-model-store.ts'
import type { RenderedFile } from './types.ts'

export interface SymbolOccurrence {
  path: string
  hunkIndex: number
  lineId: string
  lineNumber: number
  text: string
}

const WORD_CHAR = /[\w$]/

// Text under a click point may span a merged run of adjacent tokens (highlightCode
// only wraps keywords/types/functions/properties in spans — plain identifiers and
// operators land as one concatenated text node), so word boundaries have to be found
// by scanning outward from the offset rather than trusting node boundaries.
export function wordAtOffset(text: string, offset: number): string | null {
  if (!WORD_CHAR.test(text[offset] ?? '') && !WORD_CHAR.test(text[offset - 1] ?? '')) return null
  let start = offset
  while (start > 0 && WORD_CHAR.test(text[start - 1])) start--
  let end = offset
  while (end < text.length && WORD_CHAR.test(text[end])) end++
  const word = text.slice(start, end)
  return /^[A-Za-z_$]/.test(word) ? word : null
}

export function resolveClickedSymbol(x: number, y: number): string | null {
  const range = document.caretRangeFromPoint?.(x, y)
  const node = range?.startContainer
  if (!node || node.nodeType !== Node.TEXT_NODE) return null
  return wordAtOffset(node.textContent ?? '', range.startOffset)
}

// Ctrl/Cmd+click go-to-symbol: shared by both diff layouts so each one only wires up
// a single click listener rather than re-implementing the modifier check and lookup.
export function handleSymbolClick(event: MouseEvent): void {
  if (!event.metaKey && !event.ctrlKey) return
  const symbol = resolveClickedSymbol(event.clientX, event.clientY)
  if (!symbol) return
  const occurrences = findSymbolOccurrences(currentFiles.value, symbol)
  // <= 1 means the only match is the line just clicked — nowhere else to jump to.
  if (occurrences.length <= 1) return
  openSymbolLookup(event.clientX, event.clientY, symbol, occurrences)
}

export function findSymbolOccurrences(files: readonly RenderedFile[], symbol: string): SymbolOccurrence[] {
  const pattern = new RegExp(`\\b${symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
  const occurrences: SymbolOccurrence[] = []
  for (const file of files) {
    file.hunks.forEach((hunk, hunkIndex) => {
      for (const line of hunk.lines) {
        if (pattern.test(line.text)) {
          occurrences.push({
            path: file.path,
            hunkIndex,
            lineId: line.id,
            lineNumber: line.newLine ?? line.oldLine ?? 0,
            text: line.text,
          })
        }
      }
    })
  }
  return occurrences
}
