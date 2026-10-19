# Source card: `apps/backend/src/platform/platform.dto.ts`

## Canonical source

`apps/backend/src/platform/platform.dto.ts`

## Scope

Owner-bound platform control and explicitly delegated capabilities, including reason-bearing faculty/group edits and bounded organization fields. Read [implementation](../../product/platform-control.md) and [installation](../../deployment/platform-control.md) before changes. Preserve immutable owner identity, server-side permission checks and private signed agent transport.

`PlatformGrantDto.universityIds` is optional for backward compatibility. Omitted values preserve an existing grant scope; explicit `null` means global, and an array (including empty) is an explicit scope.

## Verification

Run backend/developer tsc, root lint and repository guards. Run `node --test infrastructure/control/agent.test.mjs`; integration tests require a fresh disposable local `curation_test_*` PostgreSQL database via PLATFORM_TEST_DATABASE_URL. Simulated Docker execution is not production verification.
