# Source card: `apps/backend/src/platform/platform.entity.ts`

## Canonical source

`apps/backend/src/platform/platform.entity.ts`

## Scope

Owner-bound platform control and explicitly delegated capabilities. `PlatformGrant.universityIds` is nullable: NULL means legacy/global scope, an empty list denies university records, and IDs restrict it to selected universities. Read [implementation](../../product/platform-control.md) and [installation](../../deployment/platform-control.md) before changes. Preserve immutable owner identity, server-side permission checks and private signed agent transport.

Limited grants may receive only capabilities whose every list, detail, and mutation route enforces that scope. `PlatformService.setGrant()` keeps the permission allowlist in sync with completed domain isolation.

## Verification

Run backend/developer tsc, root lint and repository guards. Run `node --test infrastructure/control/agent.test.mjs`; integration tests require a fresh disposable local `curation_test_*` PostgreSQL database via PLATFORM_TEST_DATABASE_URL. Simulated Docker execution is not production verification.
