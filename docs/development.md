# Development guide

How we build and change Review Workspace. Product rules live in [`framework.md`](framework.md); domain vocabulary in [`CONTEXT.md`](../CONTEXT.md). This document covers code shape, testing, and what "done" means for a change.

## Code clarity

**Clear beats clever.** If a reader has to re-read a block to understand it, simplify it.

- Prefer straight-line control flow over nested conditionals, ternary chains, and implicit side effects.
- Name functions and variables for what they do, not how they happen to be implemented.
- One responsibility per function or module. When a block needs a comment to explain *what* it does (not *why*), extract it.
- Keep types honest — narrow unions and explicit return types over `any` and loose casts.
- Match surrounding style: ESM imports, existing naming, file placement. A change should read like the file always looked that way.

## Architecture

### Logic lives outside components

Put behavior in **composables** (`ui/src/composables/`) and **utilities** (plain `.ts` modules under `src/` and `ui/src/`).

- **Engine** (`src/`): parsers, validators, renderers, server handlers, CLI — pure TypeScript modules with no UI.
- **UI logic** (`ui/src/*.ts`, `ui/src/composables/`): stores, view-model derivation, diff layout, markdown rendering, API clients.
- **Components** (`ui/src/components/`, `ui/src/views/`): markup, props/emits, wiring composables — no business rules inline.

### Lean components

Components are **lean**: template + minimal glue. If a `.vue` file grows logic, move it to a composable or utility and import it back.

Signs a component is too heavy:

- Script block longer than the template it serves
- Computed properties that encode domain rules instead of display shaping
- Fetch/parse/validate logic in `<script setup>`

### Split complex templates

When a template has nested conditionals, repeated structures, or a section that could stand alone, **extract a child component**. Prefer several small, named components over one file with a 200-line template.

Keep prop surfaces narrow. Pass data and callbacks, not entire stores, unless the child genuinely owns that slice of UI state.

## Testing

Every feature ships with tests. Two layers — no overlap.

### Unit tests (Vitest)

**Target:** every `.ts` module with branches, parsing, validation, or state transitions.

| Area | Location | Examples |
|------|----------|----------|
| Engine | `src/**/*.test.ts` colocated or beside module | patch parser, schema validator, bundle publish |
| UI utilities | `ui/src/**/*.test.ts` | diff layout, markdown, store reducers |

- Colocate tests as `<module>.test.ts` next to the module, or mirror the `src/` tree — follow whichever pattern the nearest neighbour uses.
- Use fixtures under `fixtures/` — synthetic only, never real Review Bundles ([ADR 0004](adr/0004-publish-the-engine-not-review-data.md)).
- **Do not** add Vue component unit tests. Component behaviour is covered by e2e.

### End-to-end tests (Playwright)

**Target:** user-visible flows through the real UI against a served bundle.

- Live under `e2e/` at the repo root.
- Start the app by serving a fixture bundle (`pnpm exec review-workspace serve fixtures/bundles/valid --port …` or equivalent test helper).
- One spec per feature or flow; name files after the behaviour (`diff-navigation.spec.ts`, not `ui.spec.ts`).
- Assert on visible outcomes and interactions — not implementation details.

### Screenshots for docs

E2e runs **capture screenshots** of key views. Save them to `docs/screenshots/` with stable, descriptive names (`diff-review-inline.png`, `image-compare-swipe.png`).

- Regenerate screenshots when the UI they depict changes.
- Reference them from [`docs/index.html`](index.html) so the landing page stays current.
- Screenshots use fixture bundles only — same synthetic-data rule as unit tests.

## Verification

A change is complete when all of the following hold:

1. **Clear** — no newly introduced hard-to-read blocks; logic extracted from components where needed.
2. **Lean** — components touched are thinner than before, or were already lean and stay that way.
3. **Tested** — every new branch in a `.ts` module has a unit test; every new user-visible flow has an e2e spec.
4. **Screenshots** — if the change alters a view shown on the landing page, `docs/screenshots/` and `docs/index.html` are updated.
5. **Green** — `pnpm test`, `pnpm typecheck`, and `pnpm test:e2e` pass.

## Commands

```sh
pnpm install
pnpm test              # vitest — engine + ui unit tests
pnpm typecheck         # tsc --noEmit (lint substitute for now)
pnpm build:ui          # build ui/ → ui-dist/
pnpm test:e2e          # playwright — e2e + doc screenshots
pnpm test:e2e:update   # refresh playwright visual baselines after intentional UI changes
```

UI hot reload during development: `node src/cli.ts serve fixtures/bundles/valid --port 4317` plus `cd ui && pnpm dev`.

## Related docs

| Doc | Scope |
|-----|-------|
| [`framework.md`](framework.md) | Product rules, bundle contract, review behaviour |
| [`spec.md`](spec.md) | v1 feature spec and user stories |
| [`CONTEXT.md`](../CONTEXT.md) | Domain glossary |
| [`CONTRIBUTING.md`](../CONTRIBUTING.md) | PR hygiene, commits, fixtures policy |
| [`fixtures/README.md`](../fixtures/README.md) | Synthetic fixture conventions |
