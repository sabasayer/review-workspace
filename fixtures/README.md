# Fixtures

Synthetic Review Bundles only — never a real bundle (per ADR 0004: proprietary
code, screenshots, and reviewer notes must never enter this public repo).

To add a fixture, create a directory under `fixtures/` shaped like a real
Review Bundle (`review.json`, `changes.diff`, `questions.jsonl`, `state.json`,
`assets/`), populated with invented file names and diffs. Reference it from a
test by its directory name.

Image assets under `assets/` must be valid files the browser can load — stub
bytes (e.g. a 4-byte placeholder) will show broken images in the UI and e2e
screenshots. The `image-pair` bundle has synthetic PNGs in
`assets/snapshot/`; see `notes.txt` there for how they were generated.
