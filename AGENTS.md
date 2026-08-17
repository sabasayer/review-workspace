# Agent instructions

Review Workspace — local, offline decision surface for reviewing a code Comparison. Read the linked docs before changing code; they are the single source of truth.

## Required reading

| When | Read |
|------|------|
| Any code change | [`docs/development.md`](docs/development.md) |
| Product or bundle behaviour | [`docs/framework.md`](docs/framework.md) |
| Domain terms | [`CONTEXT.md`](CONTEXT.md) |
| v1 scope | [`docs/spec.md`](docs/spec.md) |
| Opening a PR | [`CONTRIBUTING.md`](CONTRIBUTING.md) |

## Non-negotiables

From [`docs/development.md`](docs/development.md):

- **Clear** code — no complicated, hard-to-read blocks; extract and simplify.
- **Lean** components — logic in composables and utilities; split heavy templates into small child components.
- **Unit tests** for every `.ts` module with branches (Vitest). No Vue component unit tests.
- **E2e tests** (Playwright) for every user-visible feature; capture screenshots to `docs/screenshots/` for the landing page.

## Completion criteria

Do not mark work done until:

1. Every modified `.ts` module with new behaviour has unit test coverage.
2. Every new or changed user-visible flow has an e2e spec.
3. Landing-page views that changed have updated screenshots in `docs/screenshots/`.
4. `pnpm test && pnpm typecheck && pnpm test:e2e` pass.

## Layout

```
src/           Engine — CLI, server, schema, patch parser, renderer
ui/src/        Vue app — composables, utilities, lean components, views
fixtures/      Synthetic test bundles and patches only
e2e/           Playwright specs (user flows + doc screenshots)
docs/          Product docs, ADRs, landing page, screenshots
skills/        Generator skill (separate from engine/UI work)
```

## Generator skill

Bundle generation is out of scope for engine/UI changes — see [`skills/review-workspace/SKILL.md`](skills/review-workspace/SKILL.md).

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (`gh` CLI); external PRs are not a triage surface. See [`docs/agents/issue-tracker.md`](docs/agents/issue-tracker.md).

### Triage labels

Canonical role names used as-is (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See [`docs/agents/triage-labels.md`](docs/agents/triage-labels.md).

### Domain docs

Single-context layout — `CONTEXT.md` + `docs/adr/` at the repo root. See [`docs/agents/domain.md`](docs/agents/domain.md).
