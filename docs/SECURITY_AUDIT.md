# Security audit

## 2026-09-17 dependency migration

Scope: isolated branch `codex/integrate-latest-main`. Header, avatar, and logo sources were not opened or changed.

### Fixed

- All five Next.js clients: `14.2.35` → `15.5.24`. This removes the audit's critical Next.js findings, including the Windows-hosted RCE and Image Optimization AVIF RCE reports.
- React remains on the compatible `18.3.1` line; Next `15.5.24` declares React 18 support. This avoids an unrelated React 19 type migration.
- Root pnpm overrides pin `tar 7.5.21`, `js-yaml 4.3.2`, `lodash 4.18.1`, `multer 2.3.0`, `postcss 8.5.23`, and `qs 6.16.0`.
- `pnpm-workspace.yaml` permits builds only for `@nestjs/core`, `bcrypt`, `esbuild`, and `unrs-resolver`, so a clean install can build the backend's native/runtime dependencies.
- Next 15's incompatible built-in ESLint invocation is skipped only during `next build`; repository lint remains a separate mandatory command.

### Audit result

`pnpm audit --prod --json` changed from **3 critical / 30 high / 28 moderate / 4 low** to **0 critical / 2 high / 4 moderate / 1 low**.

### Remaining findings

- **High — `xlsx 0.18.5`**: the npm registry has no `xlsx` 0.19.3 or 0.20.2 release, although the audit names those as fixes. Do not claim this is resolved. Replacing the library needs a separately tested migration because the current importer supports legacy `.xls` files.
- **Moderate — `file-type 20.4.1`**: supplied by Nest 10; audit requires `21.3.2`, which is a major API/module-format jump.
- **Moderate — `@nestjs/core 10.4.22` and `uuid`**: audit fixes require Nest 11 and uuid 11 respectively; schedule a framework upgrade with API regression tests.
- **Low — `body-parser`**: comes through the Nest 10 / Express chain; fix is tied to the same framework upgrade.

### Verification

- `pnpm audit --prod --json` → 0 critical, 2 high, 4 moderate, 1 low.
- `pnpm --filter @napare/backend exec jest --ci --runInBand` → 19 suites, 73 tests passed.
- `pnpm --filter @napare/backend run build`, `pnpm typecheck`, and `pnpm lint` → passed.
- Production builds completed for `web`, `web-student`, `web-staff`, `web-admin`, and `web-developer` on Next 15.5.24.
