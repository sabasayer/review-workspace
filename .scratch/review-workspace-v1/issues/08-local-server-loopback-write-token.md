# 08 — Local server: loopback binding + write-token enforcement

**What to build:** The local server underlying `open` binds only to loopback and requires a per-session write token for any mutating request, so no other local process or network peer can read or alter a Reviewer's session without it.

**Blocked by:** 07 — CLI open/publish: atomic publish flow

**Status:** ready-for-agent

- [x] Server binds only to a loopback address (never `0.0.0.0` or an external interface) — hardcoded to `127.0.0.1`, no config option to change it
- [x] A per-session write token is generated on `open` and required on every mutating request
- [x] A mutating request without a valid token is rejected (401) and produces no side effect (verified: `review.json` unchanged after a rejected `/publish`)
- [x] Read-only requests (fetching the current document/state) do not require the write token
- [x] No outbound network call, telemetry, or update check occurs during normal operation — verified with a source scan for outbound-call APIs (`fetch(`, `http.request`, `https.request`, `XMLHttpRequest`, `net.connect`) run in the same test that exercises the live request path, since ESM makes runtime spying on `node:http`/`node:https` exports unsupported in Vitest (`Cannot redefine property` on a non-configurable module namespace)
