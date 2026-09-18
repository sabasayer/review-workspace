import { reactive } from 'vue'
import type { SymbolOccurrence } from '../symbol-occurrences.ts'

interface SymbolLookupState {
  open: boolean
  x: number
  y: number
  symbol: string
  occurrences: SymbolOccurrence[]
}

const state = reactive<SymbolLookupState>({ open: false, x: 0, y: 0, symbol: '', occurrences: [] })

export function symbolLookupState(): SymbolLookupState {
  return state
}

export function openSymbolLookup(x: number, y: number, symbol: string, occurrences: SymbolOccurrence[]): void {
  state.x = x
  state.y = y
  state.symbol = symbol
  state.occurrences = occurrences
  state.open = true
}

export function closeSymbolLookup(): void {
  state.open = false
}
