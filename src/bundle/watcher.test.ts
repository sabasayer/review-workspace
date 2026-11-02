import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readWatcher } from './watcher.ts'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'watcher-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function writeWatcher(content: string) {
  writeFileSync(join(dir, 'watcher.json'), content)
}

describe('readWatcher', () => {
  it('reports absent when the file does not exist', () => {
    expect(readWatcher(dir)).toEqual({ status: 'absent' })
  })

  it('reads a valid file', () => {
    writeWatcher(JSON.stringify({ enabled: true, cap: 20, used: 3 }))
    expect(readWatcher(dir)).toEqual({ status: 'ok', watcher: { enabled: true, cap: 20, used: 3, current: null } })
  })

  it('reads the id of the Question being answered', () => {
    writeWatcher(JSON.stringify({ enabled: true, cap: 20, used: 3, current: 'q-1' }))
    expect(readWatcher(dir)).toMatchObject({ status: 'ok', watcher: { current: 'q-1' } })
  })

  it('reads a null current as no Question being answered', () => {
    writeWatcher(JSON.stringify({ enabled: true, cap: 20, used: 3, current: null }))
    expect(readWatcher(dir)).toMatchObject({ status: 'ok', watcher: { current: null } })
  })

  it('reports invalid for broken JSON', () => {
    writeWatcher('{nope')
    expect(readWatcher(dir)).toMatchObject({ status: 'invalid' })
  })

  it('reports invalid for a non-object', () => {
    writeWatcher('[]')
    expect(readWatcher(dir)).toMatchObject({ status: 'invalid', message: expect.stringContaining('JSON object') })
  })

  it.each([
    [{ enabled: 'yes', cap: 20, used: 0 }, 'enabled'],
    [{ enabled: true, cap: -1, used: 0 }, 'cap'],
    [{ enabled: true, cap: 20, used: 1.5 }, 'used'],
    [{ enabled: true, cap: 20, used: 1, current: 7 }, 'current'],
  ])('reports invalid for a bad field %j', (value, field) => {
    writeWatcher(JSON.stringify(value))
    expect(readWatcher(dir)).toMatchObject({ status: 'invalid', message: expect.stringContaining(field) })
  })
})
