import type { RenderedProofBackLink } from './types.ts'

export function proofBackLinkLabel(link: RenderedProofBackLink): string {
  return link.hunkIndex === undefined ? link.path : `${link.path} (change ${link.hunkIndex + 1})`
}
