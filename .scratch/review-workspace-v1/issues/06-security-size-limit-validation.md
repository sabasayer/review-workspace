# 06 — Security & size-limit validation

**What to build:** Defensive validation that treats every bundle as untrusted input — asset path containment, Markdown HTML stripping, media-type allowlisting, and configurable size caps — proven against adversarial fixtures, not just happy-path ones.

**Blocked by:** 04 — validateBundle: blocking-error gate

**Status:** ready-for-agent

- [x] Asset references that attempt path traversal outside the bundle's `assets/` directory are rejected, not resolved (`resolveAssetPath` checks containment before any `fs` call reaches the resolved path)
- [x] Raw HTML embedded in Markdown content is stripped/disabled at render-data-prep time, not left for the UI to sanitize (`escapeRawHtml` — escapes rather than strips, so no tag-stripping bypass; not yet wired into a renderer since ticket 11 hasn't built one, but the primitive is ready and tested)
- [x] Only an approved allowlist of local media types is accepted for assets; others are rejected with a Diagnostic
- [x] Configurable limits exist for: Review Document size, patch size, per-file line count, and asset size, each independently enforced (ponytail: "per-file" line count implemented as a whole-patch line-count cap, matching the spec's single "20,000 patch lines" performance target rather than a separate per-file number — revisit if a real fixture ever needs per-file granularity)
- [x] Exceeding any configured limit produces a defined, non-crashing outcome — decided: document/patch/line-count overages **block** opening (new `BlockingReason`s: `document-too-large`, `patch-too-large`, `too-many-patch-lines`), since the engine can't safely finish processing untrusted oversized input; asset containment/type/size violations are **Diagnostics** (`unsafe-asset-path`, `disallowed-asset-type`, `asset-too-large`) since a single bad asset shouldn't block the rest of a valid bundle
- [x] Adversarial fixtures cover: path traversal attempt, oversized patch, oversized document, disallowed media type, patch exceeding line-count limit (oversized/line-count cases use a tiny `limits` override on the `valid` fixture rather than committing huge binary fixtures)
