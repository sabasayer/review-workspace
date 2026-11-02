import { nextTick } from 'vue'
import type { CodeTarget } from '../types.ts'
import { anchorId, lineAnchorId } from '../diff-layout.ts'
import { jumpTargetLineId } from '../jump-target.ts'
import { currentFiles } from './view-model-store.ts'
import { expandFile } from './expanded-files-store.ts'
import { expandHunk } from './expanded-hunks-store.ts'

const FLASH_MS = 1600

function flash(element: HTMLElement): void {
  element.classList.remove('jump-flash')
  void element.offsetWidth
  element.classList.add('jump-flash')
  setTimeout(() => element.classList.remove('jump-flash'), FLASH_MS)
}

async function scrollAndFlash(elementId: string, block: ScrollLogicalPosition): Promise<void> {
  await nextTick()
  const element = document.getElementById(elementId)
  if (!element) return
  element.scrollIntoView({ behavior: 'smooth', block })
  flash(element)
}

export async function jumpToFile(path: string): Promise<void> {
  expandFile(path)
  await scrollAndFlash(anchorId(path), 'start')
}

export async function jumpToTarget(target: CodeTarget): Promise<void> {
  const lineId = jumpTargetLineId(currentFiles.value, target)
  if (!lineId) return jumpToFile(target.path)
  expandFile(target.path)
  if (target.type === 'hunk') expandHunk(target.path, target.hunkIndex)
  else expandHunk(target.path, Number(lineId.split('#').at(-2)))
  await scrollAndFlash(lineAnchorId(lineId), 'center')
}
