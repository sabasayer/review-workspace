# Publishing prep

Goal: keep this on personal GitHub, publish to npm so people can `npx review-workspace` without cloning anything.

## npm package readiness

- [x] Remove `"private": true` from `package.json`; add `description`, `license`, `author`, `repository`, `homepage`, `bugs`, `keywords`.
- [x] Add a `LICENSE` file (MIT).
- [x] Build step: **needed** — `.ts` with native type-stripping only runs from a source checkout; Node explicitly refuses to strip types for anything under `node_modules` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`), which is exactly what `npm install`/`npx` hits. Added `tsconfig.build.json` (`rewriteRelativeImportExtensions` turns the source's explicit `.ts` import specifiers into `.js` in the emitted output) and a `pnpm build` script emitting real `dist/*.js`; `bin` now points at `dist/cli.js`.
- [x] Added a `files` allowlist (`dist`, `schemas`, `ui-dist`) so `npm pack` ships only those — confirmed `fixtures/`, `.bundles/`, `docs/`, `skills/`, and test files are excluded.
- [x] UI ships bundled: `pnpm build:ui` builds `ui/` and copies it to `ui-dist/`; the CLI's `serve` now hosts the built static app itself under `/`, with the API under `/api/*` (same prefix the UI's dev-mode Vite proxy already stripped) — one `npx review-workspace serve` command, no separate `pnpm dev`. Had to move Vite's build output dir from the default `dist/assets/` to `dist/_app/` to avoid colliding with the bundle's own `/assets/*` evidence-image route.
- [x] `npm pack --dry-run` sanity-checked — 28 files, ~204 kB packed.
- [x] Installed the real tarball in a scratch dir and confirmed `npx review-workspace open/serve` both work, including the bundled UI, its JS bundle, and the API, all through one process.

## Publish automation

- [x] Fully automatic semver + publish via [semantic-release](https://semantic-release.org/) — `.releaserc.json` (commit-analyzer → release-notes-generator → changelog → npm → github → git), triggered by `.github/workflows/release.yml` on every push to `main`. No manual version bumps, ever — versions are computed from commit messages.
- [x] Requires [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`/`fix:`/`feat!:`/etc.) going forward — documented in README's new "Releasing" section. A commit without a recognized type just doesn't trigger a release (safe no-op, not an error).
- [x] `npm publish --provenance` enabled via `publishConfig.provenance: true` in `package.json` (works automatically in GitHub Actions' OIDC context, `id-token: write` permission already set in the workflow).
- [x] Dry-ran `semantic-release --dry-run --no-ci` locally (needed Node ≥24.10 — semantic-release 25's own floor is stricter than this repo's `engines`; used `nvm use 24.14.0`) — plugin pipeline resolves cleanly end to end, only failing on the expected missing/dummy tokens.
- [ ] **You still need to do this manually** (can't be done from here): create an npm access token (Automation-type, so it isn't blocked by npm's 2FA-for-publish requirement) and add it as the `NPM_TOKEN` secret in the GitHub repo's Settings → Secrets → Actions. `GITHUB_TOKEN` is automatic, no setup needed.
- [ ] Push this repo to `https://github.com/sabasayer/review-workspace` (it isn't there yet) — the release workflow only runs once there's a `main` branch on GitHub to push to.

## Repo hygiene before going public

- [x] Scrubbed employer-specific references from `CONTEXT.md`, `README.md`, `docs/`, `fixtures/`, `ui/src/main.css` — found two real hits (an internal repo name in README, an internal discovery-prototype path/MR number in a CSS comment), both genericized. Copied the actual Generator skill (`SKILL.md`/`FRAMEWORK.md`) into `skills/review-workspace/` so the README's pointer is real instead of dangling.
- [x] `.gitignore` **did not actually exclude `.bundles/`** — a real gap, now fixed (real Review Bundles, e.g. the one with actual employer code/screenshots sitting there right now, must never enter a commit per ADR 0004). Confirmed via `git log` that no real bundle was ever historically committed.
- [x] Every commit's author email was the real employer address (`salih.sayer@founda.com`) — decided to squash all history into a single fresh commit with personal author info before the first public push (safe since nothing's been pushed to GitHub yet).
- [ ] Add a short `CONTRIBUTING.md` / issue template since external people will be filing feedback.
