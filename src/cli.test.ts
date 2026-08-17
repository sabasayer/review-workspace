import { execFileSync, spawn } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const cliPath = fileURLToPath(new URL('./cli.ts', import.meta.url))
const validBundle = fileURLToPath(new URL('../fixtures/bundles/valid/', import.meta.url))
const blockingBundle = fileURLToPath(new URL('../fixtures/bundles/unparseable-json/', import.meta.url))
const chainedRound1Bundle = fileURLToPath(new URL('../fixtures/bundles/chained-mr-42/', import.meta.url))
const chainedRound2Bundle = fileURLToPath(new URL('../fixtures/bundles/chained-mr-42-r2/', import.meta.url))

function runCli(args: string[]) {
  try {
    const stdout = execFileSync(process.execPath, [cliPath, ...args], { encoding: 'utf-8' })
    return { status: 0, stdout }
  } catch (err) {
    const e = err as { status: number; stdout: string; stderr: string }
    return { status: e.status, stdout: e.stdout, stderr: e.stderr }
  }
}

let workBundle: string

beforeEach(() => {
  workBundle = mkdtempSync(join(tmpdir(), 'review-workspace-cli-'))
  cpSync(validBundle, workBundle, { recursive: true })
})

afterEach(() => {
  rmSync(workBundle, { recursive: true, force: true })
})

describe('cli', () => {
  it('open exits 0 on a valid bundle', () => {
    const result = runCli(['open', validBundle])
    expect(result.status).toBe(0)
  })

  it('open exits non-zero on a blocked bundle', () => {
    const result = runCli(['open', blockingBundle])
    expect(result.status).not.toBe(0)
  })

  it('publish exits 0 and updates review.json on a valid staged update', () => {
    writeFileSync(
      join(workBundle, 'review.next.json'),
      JSON.stringify({ schemaVersion: 1, comparison: { base: 'abc1111', head: 'def2222' } }),
    )
    const result = runCli(['publish', workBundle])
    expect(result.status).toBe(0)
  })

  it('publish exits non-zero when review.next.json is missing', () => {
    const result = runCli(['publish', workBundle])
    expect(result.status).not.toBe(0)
  })

  it('serve starts a long-running server on the requested port and serves /document', async () => {
    const child = spawn(process.execPath, [cliPath, 'serve', validBundle, '--port', '0'], { stdio: 'pipe' })
    try {
      const info = await new Promise<{ port: number; writeToken: string; url: string }>((resolve, reject) => {
        let out = ''
        const timer = setTimeout(() => reject(new Error('timed out waiting for serve to print its info line')), 3000)
        child.stdout.on('data', (chunk) => {
          out += chunk
          const line = out.split('\n').find((l) => l.trim().startsWith('{'))
          if (line) {
            clearTimeout(timer)
            resolve(JSON.parse(line))
          }
        })
        child.on('error', reject)
      })

      expect(info.port).toBeGreaterThan(0)
      const res = await fetch(`${info.url}/document`)
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.valid).toBe(true)
    } finally {
      child.kill()
    }
  })
})

describe('cli round', () => {
  let chainedWorkParent: string
  let chainedWorkBundle: string
  let patchPath: string

  beforeEach(() => {
    chainedWorkParent = mkdtempSync(join(tmpdir(), 'review-workspace-cli-round-'))
    chainedWorkBundle = join(chainedWorkParent, 'chained-mr-42')
    cpSync(chainedRound1Bundle, chainedWorkBundle, { recursive: true })
    patchPath = join(chainedWorkParent, 'incremental.diff')
    writeFileSync(patchPath, readFileSync(join(chainedRound2Bundle, 'changes.diff'), 'utf-8'))
  })

  afterEach(() => {
    rmSync(chainedWorkParent, { recursive: true, force: true })
  })

  it('reports no new round needed when the live head matches', () => {
    const result = runCli(['round', chainedWorkBundle, '--live-head', 'bbb2222', '--patch', patchPath])
    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual({ needsNewRound: false })
  })

  it('scaffolds a sibling round bundle when the live head has moved', () => {
    const result = runCli(['round', chainedWorkBundle, '--live-head', 'ccc3333', '--patch', patchPath])
    expect(result.status).toBe(0)

    const output = JSON.parse(result.stdout)
    const expectedRoundPath = join(chainedWorkParent, 'chained-mr-42-r2')
    expect(output.needsNewRound).toBe(true)
    expect(output.bundlePath).toBe(expectedRoundPath)
    expect(output.chain).toEqual({
      mrKey: 'example/widgets!42',
      round: 2,
      previousBundle: '../chained-mr-42',
      previousHead: 'bbb2222',
    })
    expect(existsSync(expectedRoundPath)).toBe(true)

    const openResult = runCli(['open', expectedRoundPath])
    expect(openResult.status).toBe(0)
  })

  it('exits non-zero when --live-head or --patch is missing', () => {
    const result = runCli(['round', chainedWorkBundle])
    expect(result.status).not.toBe(0)
  })
})
