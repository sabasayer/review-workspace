# [1.7.0](https://github.com/sabasayer/review-workspace/compare/v1.6.0...v1.7.0) (2026-08-18)


### Features

* ship address-review-feedback consumer skill for hand-off file ([430fcbe](https://github.com/sabasayer/review-workspace/commit/430fcbe3233cfc5a51f52fc6fd9599c9a6476ed5)), closes [#18](https://github.com/sabasayer/review-workspace/issues/18) [#18](https://github.com/sabasayer/review-workspace/issues/18)

# [1.6.0](https://github.com/sabasayer/review-workspace/compare/v1.5.0...v1.6.0) (2026-08-18)


### Bug Fixes

* **carry-forward:** scope ancestor read caches to a single call ([#11](https://github.com/sabasayer/review-workspace/issues/11)) ([3d8ba67](https://github.com/sabasayer/review-workspace/commit/3d8ba67682f9920e3f5e41da17acb93ef7537424)), closes [#16](https://github.com/sabasayer/review-workspace/issues/16)
* rename mechanical resolution statuses to avoid implying judgment ([#11](https://github.com/sabasayer/review-workspace/issues/11)) ([1b036d7](https://github.com/sabasayer/review-workspace/commit/1b036d7670be04f11e8d6428cb87804c2de0cfed))


### Features

* carry forward open change-requests with evidence-backed Resolutions ([#11](https://github.com/sabasayer/review-workspace/issues/11)) ([2a82e10](https://github.com/sabasayer/review-workspace/commit/2a82e10e15731344b4e9a55a08c5057d1b920fef))

# [1.5.0](https://github.com/sabasayer/review-workspace/compare/v1.4.0...v1.5.0) (2026-08-18)


### Bug Fixes

* **#10:** match hand-off Annotation context by semantic Target equality ([7f2e9ad](https://github.com/sabasayer/review-workspace/commit/7f2e9ad625341e8b237f65a4c0161a3616e006ee)), closes [#10](https://github.com/sabasayer/review-workspace/issues/10)


### Features

* export open change-request comments as a hand-off file ([#10](https://github.com/sabasayer/review-workspace/issues/10)) ([7230452](https://github.com/sabasayer/review-workspace/commit/723045235705890a6f405500876a393c357c6ed5))

# [1.4.0](https://github.com/sabasayer/review-workspace/compare/v1.3.0...v1.4.0) (2026-08-18)


### Bug Fixes

* validate change-request resolution before writing to the log ([#9](https://github.com/sabasayer/review-workspace/issues/9)) ([090dea6](https://github.com/sabasayer/review-workspace/commit/090dea69203fe7c95bc43065e44ea84eac0fc4d2))


### Features

* raise, display, and manually resolve change-request comments ([#9](https://github.com/sabasayer/review-workspace/issues/9)) ([c22eed2](https://github.com/sabasayer/review-workspace/commit/c22eed292445fbee0eacfb5e9b570dcc16b29d7f)), closes [#7](https://github.com/sabasayer/review-workspace/issues/7)

# [1.3.0](https://github.com/sabasayer/review-workspace/compare/v1.2.0...v1.3.0) (2026-08-17)


### Features

* scaffold chained round bundles when an MR head moves ([#8](https://github.com/sabasayer/review-workspace/issues/8)) ([b801814](https://github.com/sabasayer/review-workspace/commit/b8018144e3d55678eb2f86805725b865b07857a1))

# [1.2.0](https://github.com/sabasayer/review-workspace/compare/v1.1.0...v1.2.0) (2026-08-17)


### Features

* unify Question into Comment with kind, retire Concern ([5e39452](https://github.com/sabasayer/review-workspace/commit/5e394527db1c0a2f85e8ab7c1a51fa5c30d16abf)), closes [#9](https://github.com/sabasayer/review-workspace/issues/9) [#7](https://github.com/sabasayer/review-workspace/issues/7)

# [1.1.0](https://github.com/sabasayer/review-workspace/compare/v1.0.3...v1.1.0) (2026-08-17)


### Bug Fixes

* **ci:** install ui/'s own lockfile before running tests ([5bf2caf](https://github.com/sabasayer/review-workspace/commit/5bf2caff16f7b621fcad9f62b99f4aa342d4f9a4))
* **ci:** use an admin PAT to push past branch protection ([3103428](https://github.com/sabasayer/review-workspace/commit/310342812c833c4e2c73e6f04b46ede5008b3904))


### Features

* add a Summary panel to the Review Document ([3bcc5d6](https://github.com/sabasayer/review-workspace/commit/3bcc5d64b4b68cc34d5a8855468e39cf90b0945d))
* add test baseline, refactor UI, and doc screenshots ([7431419](https://github.com/sabasayer/review-workspace/commit/7431419114951ea04f1b8e8053915ab4fb66594e))
* **ui:** add a favicon ([66db0ff](https://github.com/sabasayer/review-workspace/commit/66db0ff78b3280ca0fb0e60411482f37c85a666d))

## [1.0.3](https://github.com/sabasayer/review-workspace/compare/v1.0.2...v1.0.3) (2026-08-03)


### Bug Fixes

* stop leaving the related-target popover open from breaking the scroll-into-view ([46e5a39](https://github.com/sabasayer/review-workspace/commit/46e5a39cfe3eff856ba5579ca64e0212b08222d8))

## [1.0.2](https://github.com/sabasayer/review-workspace/compare/v1.0.1...v1.0.2) (2026-08-03)


### Bug Fixes

* stop related-target link scroll from being undone by popover focus-return ([dee7820](https://github.com/sabasayer/review-workspace/commit/dee78209e4670f734b7494f52b673b94d60f6b28))

## [1.0.1](https://github.com/sabasayer/review-workspace/compare/v1.0.0...v1.0.1) (2026-08-03)


### Bug Fixes

* remove colon-space from SKILL.md frontmatter description ([fa35da0](https://github.com/sabasayer/review-workspace/commit/fa35da0368dc0e46ed4a6794bbe4e4cf1cc90553))

# 1.0.0 (2026-07-31)


### Bug Fixes

* set publishConfig.access to public for npm provenance on first publish ([4d52edc](https://github.com/sabasayer/review-workspace/commit/4d52edc831fc3d4fd710f759b2dfc17b9d1be85d))


### Features

* initial public release of Review Workspace ([3551799](https://github.com/sabasayer/review-workspace/commit/3551799fe9dff99bcd579e0d16dc16ca114b5e2a))

# 1.0.0 (2026-07-31)


### Bug Fixes

* set publishConfig.access to public for npm provenance on first publish ([4d52edc](https://github.com/sabasayer/review-workspace/commit/4d52edc831fc3d4fd710f759b2dfc17b9d1be85d))


### Features

* initial public release of Review Workspace ([3551799](https://github.com/sabasayer/review-workspace/commit/3551799fe9dff99bcd579e0d16dc16ca114b5e2a))

# 1.0.0 (2026-07-31)


### Features

* initial public release of Review Workspace ([3551799](https://github.com/sabasayer/review-workspace/commit/3551799fe9dff99bcd579e0d16dc16ca114b5e2a))
