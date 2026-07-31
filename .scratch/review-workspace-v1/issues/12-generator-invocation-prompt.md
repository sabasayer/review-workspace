# 12 — Generator-invocation prompt surface

**What to build:** A copyable prompt, surfaced in the rendered view model, instructing the Reviewer to invoke the `/review-workspace` skill with the bundle's absolute path — the app itself never launches a Generator process.

**Blocked by:** 11 — Deterministic renderer view-model

**Status:** ready-for-agent

- [x] The view model exposes a ready-to-copy prompt string containing the bundle's absolute path (`ViewModel.generatorPrompt`, built by `buildGeneratorPrompt()` via `node:path` `resolve()` so a relative bundle path is still resolved to absolute)
- [x] No code path in the app spawns, calls, or otherwise invokes a Generator process or AI API — verified with a source scan (`child_process`, `spawn(`, `execFile(`, `anthropic`, `openai`, API-key-shaped strings) across the renderer, server, validator, and publish modules; `RegExp.exec()` deliberately excluded from the scan since it's an unrelated, legitimate API this codebase already uses
- [x] The prompt is available whenever a bundle is open, regardless of whether a Review Document update is pending — it's derived purely from the bundle path, not from document content, so it's present even when the document is minimally valid or has pending Diagnostics
- [x] Wired into the running server as `GET /view`, returning the full rendered `ViewModel` (including `generatorPrompt`) built from the currently-cached validated bundle
