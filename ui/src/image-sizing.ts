export interface ImageSizing {
  single: string
  pane: string
  paneImage: string
  stage: string
  stageImage: string
  cursor: string
}

const INLINE_SIZING: ImageSizing = {
  single: 'max-w-md',
  pane: 'max-w-md flex-1',
  paneImage: 'w-full',
  stage: 'max-w-2xl',
  stageImage: 'max-w-full',
  cursor: 'cursor-zoom-in',
}

const LARGE_SIZING: ImageSizing = {
  single: 'max-w-full',
  pane: 'min-w-0 flex-1',
  paneImage: 'max-h-[70vh] w-full object-contain',
  stage: 'max-w-full',
  stageImage: 'max-h-[70vh] max-w-full',
  cursor: '',
}

export function imageSizing(large: boolean): ImageSizing {
  return large ? LARGE_SIZING : INLINE_SIZING
}
