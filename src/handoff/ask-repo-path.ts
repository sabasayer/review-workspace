import { stdin, stdout } from 'node:process'
import { createInterface } from 'node:readline/promises'

/**
 * Real interactive `AskForRepoPath` implementation for CLI/server use —
 * prompts on stdin/stdout. Kept separate from `repo-path-cache.ts` so that
 * module stays free of any actual I/O and easy to unit test with a stub `ask`.
 */
export async function askForRepoPathOnStdin(repoSlug: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout })
  try {
    const answer = await rl.question(`Local checkout path for ${repoSlug}: `)
    return answer.trim()
  } finally {
    rl.close()
  }
}
