import { shallowRef } from 'vue'
import type { RenderedFile } from '../types.ts'

export const currentFiles = shallowRef<RenderedFile[]>([])
