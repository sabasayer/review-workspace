#!/usr/bin/env node
import { readFileSync } from 'node:fs'
import { validateBundle } from './bundle/validate-bundle.ts'
import { publishBundleAndExportHandoff } from './bundle/publish-with-handoff.ts'
import { checkRound, scaffoldNextRound } from './bundle/round.ts'
import { askForRepoPathOnStdin } from './handoff/ask-repo-path.ts'
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

if (!command || !bundlePath) {
  fail('Usage: review-workspace <open|publish|serve|round> <bundlePath> [--port N] [--live-head SHA --patch FILE]')
}

if (command === 'open') {
  const result = validateBundle(bundlePath)
  if (!result.valid) {
    fail(`Cannot open bundle: ${result.blockingReason} — ${result.message}`)
  }
  console.log('Bundle is valid.')
  if (result.diagnostics?.length) {
    console.log(`${result.diagnostics.length} diagnostic(s) found.`)
  }
} else if (command === 'publish') {
  const result = await publishBundleAndExportHandoff(bundlePath, { ask: askForRepoPathOnStdin })
  if (!result.ok) {
    fail(`Publish rejected: ${result.blockingReason} — ${result.message}`)
  }
  console.log('Published.')
  if (result.handoff?.written) {
    console.log(`Hand-off file written: ${result.handoff.filePath}`)
  }
} else if (command === 'round') {
  const liveHead = flagValue('--live-head')
  const patchPath = flagValue('--patch')
  if (!liveHead || !patchPath) {
    fail('Usage: review-workspace round <bundlePath> --live-head <sha> --patch <patchFile>')
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
  const handle = await startReviewServer(bundlePath, { port })
  console.log(JSON.stringify({ port: handle.port, writeToken: handle.writeToken, url: `http://127.0.0.1:${handle.port}` }))
} else {
  fail(`Unknown command: ${command}`)
}
