import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { raiseQuestion, readQuestions, resolveComment } from './questions/questions-log.ts'

const cliPath = fileURLToPath(new URL('./cli.ts', import.meta.url))
const validBundle = fileURLToPath(new URL('../fixtures/bundles/valid/', import.meta.url))
const diagnosticsBundle = fileURLToPath(new URL('../fixtures/bundles/diagnostics/', import.meta.url))
const blockingBundle = fileURLToPath(new URL('../fixtures/bundles/unparseable-json/', import.meta.url))
const chainedRound1Bundle = fileURLToPath(new URL('../fixtures/bundles/chained-mr-42/', import.meta.url))
const chainedRound2Bundle = fileURLToPath(new URL('../fixtures/bundles/chained-mr-42-r2/', import.meta.url))

function runCli(args: string[]) {
  const { status, stdout, stderr } = spawnSync(process.execPath, [cliPath, ...args], { encoding: 'utf-8' })
  return { status, stdout, stderr }
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

  it('open prints the code and message of each diagnostic', () => {
    const result = runCli(['open', diagnosticsBundle])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('missing-asset: Missing asset: missing.png')
    expect(result.stdout).toContain('unresolved-target: Unresolved file target: file not found in patch')
  })

  describe('open grouping and --json', () => {
    const baseDocument = { schemaVersion: 1, comparison: { base: 'abc1111', head: 'def2222' } }

    function writeReview(extra: Record<string, unknown>) {
      writeFileSync(join(workBundle, 'review.json'), JSON.stringify({ ...baseDocument, ...extra }))
    }

    const documentOnly = {
      annotations: [{ id: 'an-1', target: { type: 'file', path: 'nope.ts' }, summary: 'Gone.' }],
    }
    const bundleOnly = {
      evidence: [{ id: 'ev-1', kind: 'observed', description: 'Shot.', assetPath: 'missing.png' }],
    }

    it('open --json prints exactly one JSON object with kind, scope and message per diagnostic', () => {
      const result = runCli(['open', diagnosticsBundle, '--json'])
      expect(result.status).toBe(0)
      const output = JSON.parse(result.stdout)
      expect(output.valid).toBe(true)
      expect(output.diagnostics.length).toBeGreaterThan(0)
      for (const item of output.diagnostics) {
        expect(typeof item.kind).toBe('string')
        expect(['document', 'bundle']).toContain(item.scope)
        expect(typeof item.message).toBe('string')
      }
      const missingAsset = output.diagnostics.find((d: { kind: string }) => d.kind === 'missing-asset')
      expect(missingAsset).toMatchObject({
        scope: 'bundle',
        assetPath: 'missing.png',
        message: 'Missing asset: missing.png',
      })
      const unresolved = output.diagnostics.find((d: { kind: string }) => d.kind === 'unresolved-target')
      expect(unresolved.scope).toBe('document')
    })

    it('open --json gives invalid-field the formatted message and keeps instancePath', () => {
      writeReview({ annotations: [{ id: 'an-1', target: { type: 'file', path: 'a.ts' }, summary: 5 }] })
      const output = JSON.parse(runCli(['open', workBundle, '--json']).stdout)
      const invalid = output.diagnostics.find((d: { kind: string }) => d.kind === 'invalid-field')
      expect(invalid.message.startsWith('Invalid field (/annotations/0/summary): ')).toBe(true)
      expect(invalid.instancePath).toBe('/annotations/0/summary')
    })

    it('open --json prints an empty diagnostics list for a valid bundle', () => {
      const result = runCli(['open', validBundle, '--json'])
      expect(result.status).toBe(0)
      expect(JSON.parse(result.stdout)).toEqual({ valid: true, diagnostics: [] })
    })

    it('open --json prints valid false with the reason on a broken bundle and exits 1', () => {
      const result = runCli(['open', blockingBundle, '--json'])
      expect(result.status).toBe(1)
      const output = JSON.parse(result.stdout)
      expect(output.valid).toBe(false)
      expect(typeof output.blockingReason).toBe('string')
      expect(typeof output.message).toBe('string')
    })

    it('open prints both group headings when both scopes have diagnostics', () => {
      const result = runCli(['open', diagnosticsBundle])
      expect(result.stdout).toContain('In the review (fix these):')
      expect(result.stdout).toContain('In the bundle files:')
      expect(result.stdout).toContain('  missing-asset: Missing asset: missing.png')
      expect(result.stdout.indexOf('In the review (fix these):')).toBeLessThan(
        result.stdout.indexOf('  unresolved-target: Unresolved file target: file not found in patch'),
      )
      expect(result.stdout.indexOf('In the bundle files:')).toBeLessThan(result.stdout.indexOf('  missing-asset:'))
    })

    it('open prints only the review heading when only document diagnostics exist', () => {
      writeReview(documentOnly)
      const result = runCli(['open', workBundle])
      expect(result.stdout).toContain('In the review (fix these):')
      expect(result.stdout).toContain('  unresolved-target: ')
      expect(result.stdout).not.toContain('In the bundle files:')
    })

    it('open prints only the bundle heading when only bundle diagnostics exist', () => {
      writeReview(bundleOnly)
      const result = runCli(['open', workBundle])
      expect(result.stdout).toContain('In the bundle files:')
      expect(result.stdout).toContain('  missing-asset: Missing asset: missing.png')
      expect(result.stdout).not.toContain('In the review (fix these):')
    })

    it('open prints no group heading when there are no diagnostics', () => {
      const result = runCli(['open', validBundle])
      expect(result.stdout).toBe('Bundle is valid.\n')
    })

    it.each(['--help', '-h'])('%s prints every command and flag to stdout and exits 0', (flag) => {
      const result = runCli([flag])
      expect(result.status).toBe(0)
      expect(result.stderr).toBe('')
      for (const line of [
        '  open <bundle> [--json]',
        '  publish <bundle> [--repo PATH]',
        '  serve <bundle> [--port N] [--rotate-token] [--repo PATH]',
        '  round <bundle> --live-head SHA --patch FILE',
      ]) {
        expect(result.stdout).toContain(line)
      }
    })

    it.each([
      ['open', '--help'],
      ['serve', '--help'],
      ['open', validBundle, '-h'],
    ])('%s help flag anywhere prints the usage and exits 0', (...args) => {
      const result = runCli(args)
      expect(result.status).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.stdout).toContain('  open <bundle> [--json]')
    })

    it('the usage says the bundle path comes before the flags', () => {
      const result = runCli(['--help'])
      expect(result.stdout).toContain('Put the bundle path first. Put flags after it.')
      expect(runCli(['open', validBundle, '--json']).status).toBe(0)
    })

    it('a missing command exits 1 and prints the usage to stderr', () => {
      const result = runCli([])
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('--json')
      expect(result.stderr).toContain('--rotate-token')
    })
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

  it('publish prints each diagnostic of the staged document', () => {
    writeFileSync(
      join(workBundle, 'review.next.json'),
      JSON.stringify({
        schemaVersion: 1,
        comparison: { base: 'abc1111', head: 'def2222' },
        annotations: [{ id: 'an-1', target: { type: 'binary', path: 'shots/page.png' }, summary: 'Page changed.' }],
      }),
    )
    const result = runCli(['publish', workBundle])
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('image-without-comparison: Changed image has no base and head asset: shots/page.png')
  })

  describe('publish hand-off', () => {
    let repoDir: string

    beforeEach(() => {
      repoDir = mkdtempSync(join(tmpdir(), 'review-workspace-cli-repo-'))
      execFileSync('git', ['init', '-q'], { cwd: repoDir })
      writeFileSync(
        join(workBundle, 'review.next.json'),
        JSON.stringify({ schemaVersion: 1, comparison: { base: 'abc1111', head: 'def2222', repository: 'example/widgets', number: '7' } }),
      )
      raiseQuestion(workBundle, 'Please fix the retry logic.', { type: 'file', path: 'src/config.ts' }, 'change-request')
    })

    afterEach(() => {
      rmSync(repoDir, { recursive: true, force: true })
    })

    it('writes the hand-off file into the repo given by --repo', () => {
      const result = runCli(['publish', workBundle, '--repo', repoDir])
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('Hand-off file written:')
      expect(existsSync(join(repoDir, '.review-feedback', '7-round1.md'))).toBe(true)
      expect(existsSync(join(repoDir, '.gitignore'))).toBe(false)
    })

    it('prints one skip line and does not prompt when --repo is missing', () => {
      const result = runCli(['publish', workBundle])
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('Hand-off skipped: pass --repo <path> to export the open change-requests.')
    })
  })

  it('publish exits non-zero when review.next.json is missing', () => {
    const result = runCli(['publish', workBundle])
    expect(result.status).not.toBe(0)
  })

  describe('serve', () => {
    async function serveOnce(args: string[] = []) {
      const child = spawn(process.execPath, [cliPath, 'serve', workBundle, '--port', '0', ...args], { stdio: 'pipe' })
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
      return { child, info }
    }

    it('starts a long-running server on the requested port and serves /document', async () => {
      const { child, info } = await serveOnce()
      try {
        expect(info.port).toBeGreaterThan(0)
        const res = await fetch(`${info.url}/document`)
        expect(res.status).toBe(200)
        const body = await res.json()
        expect(body.valid).toBe(true)
      } finally {
        child.kill()
      }
    })

    it('prints the same write token on every start', async () => {
      const first = await serveOnce()
      first.child.kill()
      const second = await serveOnce()
      second.child.kill()
      expect(second.info.writeToken).toBe(first.info.writeToken)
    })

    it('prints a new write token with --rotate-token', async () => {
      const first = await serveOnce()
      first.child.kill()
      const second = await serveOnce(['--rotate-token'])
      second.child.kill()
      expect(second.info.writeToken).not.toBe(first.info.writeToken)
    })
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

  it('scaffolds the new round with the open change-requests of the previous one', () => {
    const open = raiseQuestion(chainedWorkBundle, 'still open', undefined, 'change-request')
    const done = raiseQuestion(chainedWorkBundle, 'done', undefined, 'change-request')
    resolveComment(chainedWorkBundle, done.id)

    const result = runCli(['round', chainedWorkBundle, '--live-head', 'ccc3333', '--patch', patchPath])
    expect(result.status).toBe(0)

    const carried = readQuestions(JSON.parse(result.stdout).bundlePath)
    expect(carried.map((c) => c.id)).toEqual([open.id])
  })

  it('exits non-zero when --live-head or --patch is missing', () => {
    const result = runCli(['round', chainedWorkBundle])
    expect(result.status).not.toBe(0)
  })
})
