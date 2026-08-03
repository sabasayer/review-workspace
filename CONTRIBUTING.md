# Contributing

Thanks for taking a look at this. It's a small, personal project — issues and PRs are welcome, but keep changes scoped and don't feel obligated to solve everything at once.

## Setup

```sh
pnpm install
pnpm test         # vitest
pnpm typecheck    # tsc --noEmit, doubling as lint (no separate linter yet)
```

`ui/` is a separate app with its own `pnpm install`/`pnpm dev` — see the main [README](README.md#development).

## Code and tests

Follow [`docs/development.md`](docs/development.md): clear readable code, lean Vue
components with logic in composables/utilities, Vitest unit tests for `.ts`
modules, Playwright e2e for user-visible features (with doc screenshots). No
Vue component unit tests.

## Commit messages

Releases are fully automated from commit messages (see the README's
["Releasing"](README.md#releasing) section) — please use [Conventional
Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`,
`chore:`, etc.) so your change actually ships in a release once merged.

## Fixtures, not real bundles

Add test fixtures under `fixtures/` (see `fixtures/README.md`) — they must be
synthetic. Never commit a real Review Bundle (one generated against an actual
MR/PR): it may contain someone else's proprietary code or screenshots.
`.bundles/` is gitignored for exactly this reason — don't remove that entry.

## Opening a PR

- Keep it focused — one behavior change per PR is easier to review than a bundle of unrelated fixes.
- Add or update a unit test for every changed `.ts` module with new branches; add or update an e2e spec for changed user-visible flows.
- Update `docs/screenshots/` when the landing page should reflect a UI change.
- `pnpm test && pnpm typecheck && pnpm test:e2e` should pass before you open it.
