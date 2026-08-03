# Review Workspace

A local, offline decision surface for reviewing a code Comparison. See
`docs/framework.md` for product rules, `CONTEXT.md` for the domain glossary,
and `docs/spec.md` for the v1 spec.

## Reviewing an MR/PR

This repo (the engine: schema, validator, CLI, server, UI) never fetches a Comparison or writes a Review Document itself — that's the Generator's job, a separate Claude Code skill (see `skills/review-workspace/`).

**Install the skill** (one-time, requires [Claude Code](https://claude.com/claude-code) — CLI, desktop app, or the claude.ai/code web app; a plain claude.ai chat can't run it, since it shells out to `glab`/`gh`/`npx`):

```sh
npx skills add sabasayer/review-workspace --global --agent claude-code -y
```

(Uses [vercel-labs/skills](https://github.com/vercel-labs/skills). Later, `npx skills update review-workspace` picks up any changes to the skill.)

Also requires:

- `glab` (GitLab) or `gh` (GitHub) CLI, installed and authenticated — that's what fetches the MR/PR diff.
- **Node ≥24** — `npx` itself ships with Node/npm, nothing extra to install, but an older Node on your `PATH` will fail to run the CLI. Check with `node --version`; if it's below 24, upgrade (e.g. via [nvm](https://github.com/nvm-sh/nvm): `nvm install 24 && nvm use 24`) before running `npx review-workspace`.

**Use it**: paste an MR/PR URL to Claude Code and ask it to review it, e.g. "Review this MR using the review-workspace skill: `<url>`". The skill scaffolds a bundle under `.bundles/`, generates + publishes the Review Document, then `serve`s it (see below) — no local clone of this repo needed, `npx` fetches the CLI/UI on demand.

To view an already-scaffolded bundle:

```sh
npx review-workspace serve .bundles/<name> --port 4317
```

Opens the UI at `http://127.0.0.1:4317` (prints a write token too — needed only to raise/answer Questions, not to view). One process, no separate dev server.

## Development

```sh
pnpm install
pnpm test         # vitest
pnpm typecheck    # tsc --noEmit, doubling as lint (ponytail: no separate linter yet)
pnpm build:ui     # builds ui/ and copies it to ui-dist/ so `serve` hosts the UI itself
```

While developing the UI itself, run the two pieces separately instead — `node src/cli.ts serve .bundles/<name> --port 4317` for the API, and `cd ui && pnpm dev` for the UI with hot reload (its Vite dev server proxies `/api/*` to the port above).

Add fixtures under `fixtures/` — see `fixtures/README.md`. Never commit a real
Review Bundle (per ADR 0004); fixtures are synthetic only.

## Releasing

Versioning and npm publishing are fully automated by
[semantic-release](https://semantic-release.org/) (`.releaserc.json`,
`.github/workflows/release.yml`) — every push to `main` computes the next
version from commit messages, publishes to npm, tags the release, and
updates `CHANGELOG.md`. There is no manual version bump.

This only works if commits follow [Conventional
Commits](https://www.conventionalcommits.org/): a `type` prefix tells
semantic-release what kind of release (if any) the commit deserves. A commit
that doesn't match a recognized type is ignored for versioning — safe, but it
means that change won't ship until a later commit does trigger a release.

```
fix: correct hunk line-target off-by-one          # patch release
feat: add file-level diff collapse                # minor release
feat!: rename Target `kind` to `type`              # major release (breaking)

BREAKING CHANGE: `target.kind` renamed to `target.type` in the Review Document schema.
```

Other common types (`docs:`, `chore:`, `refactor:`, `test:`) don't trigger a
release on their own.
