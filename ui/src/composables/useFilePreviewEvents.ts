import { onBeforeUnmount, onMounted } from 'vue'
import { isJumpClick, resolveFileRef } from '../file-refs.ts'
import { closePreview, openPreview } from './file-preview-store.ts'
import { currentFiles } from './view-model-store.ts'
import { jumpToFile } from './jump-to-diff.ts'

const OPEN_DELAY_MS = 250
const CLOSE_DELAY_MS = 200
const POPOVER_SELECTOR = '[data-file-preview]'
const REF_SELECTOR = '[data-file-ref]'

export function useFilePreviewEvents(): void {
  let timer: ReturnType<typeof setTimeout> | undefined

  const refOf = (target: EventTarget | null) => (target instanceof Element ? target.closest<HTMLElement>(REF_SELECTOR) : null)
  const insidePopover = (target: EventTarget | null) => target instanceof Element && target.closest(POPOVER_SELECTOR) !== null

  function scheduleOpen(element: HTMLElement, delay: number) {
    clearTimeout(timer)
    timer = setTimeout(() => {
      const box = element.getBoundingClientRect()
      void openPreview(element.dataset.fileRef ?? '', { left: box.left, top: box.top, bottom: box.bottom })
    }, delay)
  }

  function scheduleClose() {
    clearTimeout(timer)
    timer = setTimeout(closePreview, CLOSE_DELAY_MS)
  }

  function keepOpen() {
    clearTimeout(timer)
  }

  function onOver(event: MouseEvent) {
    const element = refOf(event.target)
    if (element) scheduleOpen(element, OPEN_DELAY_MS)
    else if (insidePopover(event.target)) keepOpen()
  }

  function onOut(event: MouseEvent) {
    if (refOf(event.target) || insidePopover(event.target)) scheduleClose()
  }

  function onFocusIn(event: FocusEvent) {
    const element = refOf(event.target)
    if (element) scheduleOpen(element, 0)
  }

  function onFocusOut(event: FocusEvent) {
    if (refOf(event.target)) scheduleClose()
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      clearTimeout(timer)
      closePreview()
      return
    }
    const element = refOf(event.target)
    if (element && event.key === 'Enter' && event.ctrlKey) jumpFromRef(element)
  }

  function onClick(event: MouseEvent) {
    const element = refOf(event.target)
    if (element && isJumpClick(event)) {
      event.preventDefault()
      jumpFromRef(element)
    }
  }

  function jumpFromRef(element: HTMLElement) {
    const ref = resolveFileRef(element.dataset.fileRef ?? '', currentFiles.value.map((f) => f.path))
    if (ref.kind !== 'diff') return
    closePreview()
    void jumpToFile(ref.path)
  }

  const closeOnScroll = () => closePreview()

  onMounted(() => {
    document.addEventListener('mouseover', onOver)
    document.addEventListener('mouseout', onOut)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    document.addEventListener('keydown', onKeydown)
    document.addEventListener('click', onClick, true)
    document.addEventListener('scroll', closeOnScroll, true)
  })

  onBeforeUnmount(() => {
    clearTimeout(timer)
    document.removeEventListener('mouseover', onOver)
    document.removeEventListener('mouseout', onOut)
    document.removeEventListener('focusin', onFocusIn)
    document.removeEventListener('focusout', onFocusOut)
    document.removeEventListener('keydown', onKeydown)
    document.removeEventListener('click', onClick, true)
    document.removeEventListener('scroll', closeOnScroll, true)
  })
}
