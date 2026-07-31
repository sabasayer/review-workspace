import { PatchParseError, type ParsedPatch, type PatchFile, type PatchHunk } from './types.ts'

const GIT_FILE_HEADER = /^diff --git a\/(.+) b\/(.+)$/
const OLD_FILE_MARKER = /^--- (.+)$/
const NEW_FILE_MARKER = /^\+\+\+ (.+)$/
const BINARY_MARKER = /^Binary files (?:a\/)?(.+) and (?:b\/)?(.+) differ$/
const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/

function stripPrefix(path: string): string {
  if (path === '/dev/null') return path
  if (path.startsWith('a/') || path.startsWith('b/')) return path.slice(2)
  return path
}

/**
 * Parses both git's extended unified diff format ("diff --git a/X b/Y" plus
 * "--- "/"+++ " headers) and a bare POSIX unified diff (just "--- "/"+++ ",
 * no "diff --git" line, no a/ b/ path prefixes) — real Generators and forge
 * tooling (e.g. `glab mr diff`) emit either shape.
 */
export function parsePatch(text: string): ParsedPatch {
  const lines = text.split('\n')
  if (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop()
  }
  const files: PatchFile[] = []
  let currentFile: PatchFile | null = null
  let currentHunk: PatchHunk | null = null
  let pendingGitPaths: { old: string; new: string } | null = null
  let pendingOldPath: string | null = null

  const closeHunk = () => {
    if (!currentHunk) return
    const expected = currentHunk.oldLines + currentHunk.newLines
    const seenOld = currentHunk.lines.filter((l) => l.kind !== 'add').length
    const seenNew = currentHunk.lines.filter((l) => l.kind !== 'remove').length
    if (seenOld !== currentHunk.oldLines || seenNew !== currentHunk.newLines) {
      throw new PatchParseError(
        `Truncated hunk in ${currentFile?.path ?? 'unknown file'}: expected ${expected} old/new lines, saw ${seenOld}/${seenNew}`,
      )
    }
    currentHunk = null
  }

  for (const line of lines) {
    const gitFileMatch = GIT_FILE_HEADER.exec(line)
    if (gitFileMatch) {
      closeHunk()
      pendingGitPaths = { old: gitFileMatch[1], new: gitFileMatch[2] }
      continue
    }

    const binaryMatch = BINARY_MARKER.exec(line)
    if (binaryMatch) {
      closeHunk()
      // A bare unified diff (no "diff --git") can still emit "--- "/"+++ " for a binary
      // file before the "Binary files ... differ" line — that already created a
      // (non-binary, hunk-less) file entry above, which this just converts in place
      // rather than pushing a duplicate. Trust that already-open entry's path over the
      // Binary marker's own paths: for a bare-format deletion the marker line reads
      // "Binary files a/X and /dev/null differ", so deriving identity from its second
      // capture group would wrongly produce "/dev/null" instead of the real path X.
      if (!pendingGitPaths && currentFile !== null && currentFile.hunks.length === 0 && !currentFile.binary) {
        currentFile.binary = true
      } else {
        const path = pendingGitPaths?.new ?? stripPrefix(binaryMatch[2])
        currentFile = {
          path,
          oldPath: pendingGitPaths?.old ?? stripPrefix(binaryMatch[1]),
          binary: true,
          hunks: [],
        }
        files.push(currentFile)
      }
      pendingGitPaths = null
      continue
    }

    if (line.startsWith('index ')) continue

    // A real file header only ever appears between hunks, never inside one — so once a
    // hunk is open and still expects more lines, a "--- "/"+++ "-prefixed line is content
    // (e.g. a removed line whose text itself starts with "-- "), not a new file boundary.
    if (!currentHunk) {
      const oldMatch = OLD_FILE_MARKER.exec(line)
      if (oldMatch) {
        pendingOldPath = stripPrefix(oldMatch[1])
        continue
      }

      const newMatch = NEW_FILE_MARKER.exec(line)
      if (newMatch) {
        closeHunk()
        const newPath = stripPrefix(newMatch[1])
        currentFile = {
          path: pendingGitPaths?.new ?? newPath,
          oldPath: pendingGitPaths?.old ?? pendingOldPath ?? newPath,
          binary: false,
          hunks: [],
        }
        files.push(currentFile)
        pendingGitPaths = null
        pendingOldPath = null
        continue
      }
    }

    if (!currentFile) {
      if (line.trim() === '') continue
      throw new PatchParseError(`Content encountered before any file header: ${JSON.stringify(line)}`)
    }

    const hunkMatch = HUNK_HEADER.exec(line)
    if (hunkMatch) {
      closeHunk()
      currentHunk = {
        oldStart: Number(hunkMatch[1]),
        oldLines: hunkMatch[2] !== undefined ? Number(hunkMatch[2]) : 1,
        newStart: Number(hunkMatch[3]),
        newLines: hunkMatch[4] !== undefined ? Number(hunkMatch[4]) : 1,
        lines: [],
      }
      currentFile.hunks.push(currentHunk)
      continue
    }

    if (currentHunk) {
      const marker = line[0]
      const text = line.slice(1)
      let oldLine: number | undefined
      let newLine: number | undefined
      const priorOld = currentHunk.lines.filter((l) => l.kind !== 'add').length
      const priorNew = currentHunk.lines.filter((l) => l.kind !== 'remove').length

      if (marker === '+') {
        newLine = currentHunk.newStart + priorNew
        currentHunk.lines.push({ kind: 'add', text, newLine })
      } else if (marker === '-') {
        oldLine = currentHunk.oldStart + priorOld
        currentHunk.lines.push({ kind: 'remove', text, oldLine })
      } else if (marker === ' ' || line === '') {
        oldLine = currentHunk.oldStart + priorOld
        newLine = currentHunk.newStart + priorNew
        currentHunk.lines.push({ kind: 'context', text: line === '' ? '' : text, oldLine, newLine })
      } else if (line === '\\ No newline at end of file') {
        continue
      } else {
        throw new PatchParseError(`Unrecognized hunk line prefix in ${currentFile.path}: ${JSON.stringify(line)}`)
      }

      // Self-close the moment declared counts are satisfied, rather than waiting for the
      // next header line to trigger it — otherwise an immediately-following bare "--- "/
      // "+++ " file header (no git "diff --git" line ahead of it) is mistaken for hunk
      // content, since the ambiguity guard above only reopens header-detection once no
      // hunk is open.
      const seenOld = currentHunk.lines.filter((l) => l.kind !== 'add').length
      const seenNew = currentHunk.lines.filter((l) => l.kind !== 'remove').length
      if (seenOld === currentHunk.oldLines && seenNew === currentHunk.newLines) {
        currentHunk = null
      }
      continue
    }

    // A hunk self-closes as soon as its declared line count is satisfied (see above), but a
    // trailing "no newline" marker for the hunk's last line arrives as the very next line —
    // after the self-close, so it must still be recognized here, not just while a hunk is open.
    if (line === '\\ No newline at end of file') continue

    if (line.trim() !== '') {
      throw new PatchParseError(`Unexpected content outside a hunk in ${currentFile.path}: ${JSON.stringify(line)}`)
    }
  }

  closeHunk()
  return { files }
}
