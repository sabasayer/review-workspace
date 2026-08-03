# Claude Code instructions

Same rules as [`AGENTS.md`](AGENTS.md). This file exists so Claude Code picks up repo conventions automatically.

## Start here

1. [`docs/development.md`](docs/development.md) — code clarity, lean components, testing, verification
2. [`docs/framework.md`](docs/framework.md) — product rules and bundle contract
3. [`CONTEXT.md`](CONTEXT.md) — domain glossary

## Working on the engine or UI

Follow [`docs/development.md`](docs/development.md) in full. Summary:

- Logic in composables (`ui/src/composables/`) and utilities (`src/`, `ui/src/*.ts`); components stay lean.
- Unit tests (Vitest) for TypeScript modules; e2e (Playwright) for features — no component unit tests.
- E2e screenshots go to `docs/screenshots/` and feed [`docs/index.html`](docs/index.html).

Work is complete only when unit coverage, e2e coverage, and `pnpm test && pnpm typecheck` all pass.

## Working as the Generator

When generating or improving Review Documents — not engine/UI code — use [`skills/review-workspace/SKILL.md`](skills/review-workspace/SKILL.md) and its [`FRAMEWORK.md`](skills/review-workspace/FRAMEWORK.md).
