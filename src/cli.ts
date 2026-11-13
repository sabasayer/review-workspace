#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { diagnosticToJson, formatDiagnostic, formatDiagnosticGroups } from './bundle/format-diagnostic.ts'
import { validateBundle } from './bundle/validate-bundle.ts'
import { publishBundleAndExportHandoff } from './bundle/publish-with-handoff.ts'
import { checkRound, scaffoldNextRound } from './bundle/round.ts'
import { carryForwardChain } from './bundle/carry-forward.ts'
import { startReviewServer } from './server/create-server.ts'

const [, , command, bundlePath, ...rest] = process.argv

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function flagValue(name: string): string | undefined {
  const index = rest.indexOf(name)
  return index === -1 ? undefined : rest[index + 1]
}

const usage = `Usage: review-workspace <command> <bundle> [flags]
Put the bundle path first. Put flags after it.

Commands:
  open <bundle> [--json]
  publish <bundle> [--repo PATH]
  serve <bundle> [--port N] [--rotate-token] [--repo PATH]
  round <bundle> --live-head SHA --patch FILE

Flags:
  --help, -h  Print this text.`

if (process.argv.slice(2).some((arg) => arg === '--help' || arg === '-h')) {
  console.log(usage)
  process.exit(0)
}

if (!command || !bundlePath) {
  fail(usage)
}

if (command === 'open') {
  carryForwardChain(bundlePath)
  const result = validateBundle(bundlePath)
  const asJson = rest.includes('--json')
  if (!result.valid) {
    if (!asJson) fail(`Cannot open bundle: ${result.blockingReason} — ${result.message}`)
    console.log(JSON.stringify({ valid: false, blockingReason: result.blockingReason, message: result.message }))
    process.exit(1)
  }
  const diagnostics = result.diagnostics ?? []
  if (asJson) {
    console.log(JSON.stringify({ valid: true, diagnostics: diagnostics.map(diagnosticToJson) }))
  } else {
    console.log('Bundle is valid.')
    if (diagnostics.length) {
      console.log(`${diagnostics.length} diagnostic(s) found.`)
      for (const line of formatDiagnosticGroups(diagnostics)) console.log(line)
    }
  }
} else if (command === 'publish') {
  const result = await publishBundleAndExportHandoff(bundlePath, { repoPath: flagValue('--repo') })
  if (!result.ok) {
    fail(`Publish rejected: ${result.blockingReason} — ${result.message}`)
  }
  console.log('Published.')
  for (const diagnostic of result.diagnostics ?? []) {
    console.log(`  ${formatDiagnostic(diagnostic)}`)
  }
  if (result.handoff?.written) {
    console.log(`Hand-off file written: ${result.handoff.filePath}`)
  } else if (result.handoff?.skipped === 'no-repo-path') {
    console.log('Hand-off skipped: pass --repo <path> to export the open change-requests.')
  } else if (result.handoff?.skipped === 'no-review-key') {
    console.log('Hand-off skipped: the Comparison has no number and no sourceBranch to name the file.')
  } else if (result.handoff?.skipped === 'not-a-git-repo') {
    console.log('Hand-off skipped: the --repo path is not a git repository.')
  }
} else if (command === 'round') {
  const liveHead = flagValue('--live-head')
  const patchPath = flagValue('--patch')
  if (!liveHead || !patchPath) {
    fail('Usage: review-workspace round <bundle> --live-head SHA --patch FILE')
  }

  const { needsNewRound } = checkRound(bundlePath, liveHead)
  if (!needsNewRound) {
    console.log(JSON.stringify({ needsNewRound: false }))
  } else {
    const patch = readFileSync(patchPath, 'utf-8')
    const result = scaffoldNextRound(bundlePath, liveHead, { patch })
    console.log(JSON.stringify({ needsNewRound: true, ...result }))
  }
} else if (command === 'serve') {
  const port = Number(flagValue('--port') ?? 4317)
  const handle = await startReviewServer(bundlePath, { port, rotateToken: rest.includes('--rotate-token'), repoPath: flagValue('--repo') })
  console.log(JSON.stringify({ port: handle.port, writeToken: handle.writeToken, url: `http://127.0.0.1:${handle.port}` }))
} else {
  fail(`Unknown command: ${command}`)
}
