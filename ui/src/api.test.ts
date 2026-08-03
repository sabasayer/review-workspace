import { describe, expect, it } from 'vitest'
import { assetUrl } from './api.ts'

describe('assetUrl', () => {
  it('prefixes the API assets route', () => {
    expect(assetUrl('snapshot/head.png')).toBe('/api/assets/snapshot/head.png')
  })

  it('encodes path segments', () => {
    expect(assetUrl('uploads/hash/file name.png')).toBe('/api/assets/uploads/hash/file%20name.png')
  })
})
