# 09 — File watching for live re-validation

**What to build:** The running server watches the open bundle directory and re-validates/re-renders automatically when a Generator publishes an update, so the Reviewer never has to manually reload to see a new `review.json`.

**Blocked by:** 07 — CLI open/publish: atomic publish flow

**Status:** ready-for-agent

- [x] A `publish` event (successful atomic replace of `review.json`) while the server is running triggers automatic re-validation
- [x] The server exposes the freshly validated document/diagnostics to a connected client without requiring a manual restart or reload
- [x] A `publish` that fails validation does not trigger a change to what the server is currently serving (last-valid document is retained, per framework rule)
- [x] File-watch behavior is tested by simulating a publish while a fake client is "connected," asserting served content before/after

Implementation notes: `/document` now serves a cached `latest` result updated only by the watcher's `change` event, rather than re-reading `review.json` on every request — this makes the watcher load-bearing (skip it and `/document` goes stale) instead of a no-op wrapper around an already-stateless design. The watcher polls `review.json`'s mtime (`src/server/watch-bundle.ts`) rather than using `fs.watch`: `fs.watch`'s rename/change semantics are inconsistent across platforms for atomic-rename-based writes, and a first SSE-push implementation attempted here was dropped after proving flaky in tests (Node's `fetch`/undici stream-reader timing was unreliable in this environment) — polling + asserting via `/document` is simpler and deterministic. `close()` stops the watcher to avoid leaking timers.
