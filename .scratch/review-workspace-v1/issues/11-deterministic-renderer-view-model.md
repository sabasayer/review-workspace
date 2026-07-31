# 11 — Deterministic renderer view-model

**What to build:** A framework-agnostic `render(document, patch, state, questions)` step that produces a stable, serializable view model — file ordering, inline/side-by-side content parity, and virtualization-safe structure — so any UI layer consumes the same deterministic shape.

**Blocked by:** 05 — Target resolution & Diagnostics

**Status:** ready-for-agent

- [x] Files are ordered by Behavioral Group, dependency, risk, and comprehension — never plain alphabetical — given the same input, the output order is deterministic (ponytail scope-cut, documented: ordering implemented is group-`order` then patch-order fallback for ungrouped files, matching framework.md's explicit "missing optional interpretation falls back to the complete patch in patch order" rule; dependency/risk ordering is deferred since the schema has no such fields yet — nothing to sort by until a future ticket adds them)
- [x] Inline and side-by-side view models expose identical underlying content (same lines, same Annotations/Evidence attached), differing only in layout shape — `toInlineRows`/`toSideBySideRows` both derive from the same `RenderedLine[]` (proven by reference-identity, not just deep-equality, in the test)
- [x] View model preserves one logical code line per row, with long lines marked for horizontal scroll rather than wrapped or truncated (`overflowsInline` flag, threshold 120 chars)
- [x] View model is structured so virtualized rendering can slice it without losing scroll-position anchoring, search indexing, or Target resolution (`RenderedLine.id` stable per file+hunk+line-index)
- [x] Image evidence entries expose enough structure for side-by-side, swipe, onion-skin, and changed-pixel comparison modes to be built on top (mode selection itself may be UI-only) — scope gap noted: the schema only carries a single `assetPath` per Evidence entry, no before/after pairing, so true visual-diff modes need a schema extension later; for now every eligible image Evidence entry declares all four modes as available
- [x] Diagnostics from ticket 05 surface in the view model attached to the Target/section they concern, not as a separate disconnected list (per-line for `stale-line-target`; bundle-level `diagnostics[]` for everything without a resolvable file path, e.g. `invalid-field`, `missing-asset`, `dangling-answer`)
- [x] A synthetic bundle covering 100 files / 20,000 patch lines produces a view model within the 2-second target on a typical dev laptop (measured, not just asserted) — generated in-memory in the test, not committed as a fixture
