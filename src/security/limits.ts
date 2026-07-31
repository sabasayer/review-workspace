export interface BundleLimits {
  maxDocumentBytes: number
  maxPatchBytes: number
  maxPatchLines: number
  maxAssetBytes: number
}

export const DEFAULT_LIMITS: BundleLimits = {
  maxDocumentBytes: 5 * 1024 * 1024,
  maxPatchBytes: 20 * 1024 * 1024,
  maxPatchLines: 20_000,
  maxAssetBytes: 10 * 1024 * 1024,
}
