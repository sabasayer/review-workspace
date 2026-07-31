import { resolve, sep } from 'node:path'

export const ALLOWED_ASSET_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp']

export type AssetPathResolution =
  | { ok: true; absolutePath: string }
  | { ok: false; reason: 'unsafe-path' | 'disallowed-type' }

/** Resolves an evidence-declared relative path against the bundle's assets/ directory, refusing to leave it. */
export function resolveAssetPath(bundlePath: string, assetPath: string): AssetPathResolution {
  const assetsDir = resolve(bundlePath, 'assets')
  const resolved = resolve(assetsDir, assetPath)

  if (resolved !== assetsDir && !resolved.startsWith(assetsDir + sep)) {
    return { ok: false, reason: 'unsafe-path' }
  }

  const lowerPath = resolved.toLowerCase()
  if (!ALLOWED_ASSET_EXTENSIONS.some((ext) => lowerPath.endsWith(ext))) {
    return { ok: false, reason: 'disallowed-type' }
  }

  return { ok: true, absolutePath: resolved }
}
