import { shallowRef } from 'vue'
import type { RenderedFile } from './types.ts'

// Module-level so components far from DiffReviewView's fetch loop (e.g. AnnotationBadge's
// related-target hover preview) can resolve any Target's diff lines without prop-drilling
// the full file list through every intermediate component — same rationale as
// expanded-hunks-store.ts.
export const currentFiles = shallowRef<RenderedFile[]>([])
