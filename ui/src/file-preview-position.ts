export interface AnchorBox {
  left: number
  top: number
  bottom: number
}

export interface Viewport {
  width: number
  height: number
}

export interface PopoverPlacement {
  left: number
  top?: number
  bottom?: number
}

const MARGIN = 8
const GAP = 6
const MIN_ROOM_BELOW = 260

export function placePopover(anchor: AnchorBox, viewport: Viewport, popoverWidth: number): PopoverPlacement {
  const left = Math.max(MARGIN, Math.min(anchor.left, viewport.width - popoverWidth - MARGIN))
  const roomBelow = viewport.height - anchor.bottom
  if (roomBelow >= MIN_ROOM_BELOW || roomBelow >= anchor.top) return { left, top: anchor.bottom + GAP }
  return { left, bottom: viewport.height - anchor.top + GAP }
}
