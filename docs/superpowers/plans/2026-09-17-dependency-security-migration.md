# Dependency security migration — 2026-09-17

## Scope

Isolated branch `codex/integrate-latest-main` only. Do not modify header, avatar, or logo sources.

## Steps

1. Capture the production audit baseline and identify the direct dependency paths.
2. Upgrade all five Next.js clients from 14.2.35 to the patched 15.5.24 line with the matching React 19 toolchain; run the official upgrade codemod only if static checks find affected APIs.
3. Keep `xlsx` unchanged: npm has no published version that satisfies the audit's stated fixes, and replacing it would remove existing `.xls` compatibility. Record it as a release blocker rather than make an incompatible substitution.
4. Pin vulnerable transitive packages via root pnpm overrides at the first published patched version: `tar`, `js-yaml`, `lodash`, `postcss`, `qs`, and `multer`.
5. Regenerate the lockfile, run the production audit, backend tests/build, every web typecheck/build, and lint; document the resulting audit status.
