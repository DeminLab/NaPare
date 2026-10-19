# Source card: `apps/backend/src/platform/platform.service.ts`

## Canonical source

`apps/backend/src/platform/platform.service.ts`

## Scope

DevOps account management includes other technical accounts, except owner/self and platform-role reassignment. Owner-only emergencyRevoke verifies the current password, atomically removes grants and invalidates non-owner technical sessions. This does not revoke SSH access or cancel accepted agent jobs.

Owner-bound platform control and explicitly delegated capabilities, including audited identity unlink, university scoped faculty/group management, and safe projections that omit connector secrets. Reasoned organization mutations keep group external IDs and curator assignment outside this workflow. Read [implementation](../../product/platform-control.md) and [installation](../../deployment/platform-control.md) before changes. Preserve immutable owner identity, server-side permission checks and private signed agent transport.

`access()` returns the delegated university scope. Owner access is always global. Core account and university-structure routes enforce the scope. `setGrant()` validates university IDs and rejects limited grants containing permissions whose routes do not enforce tenant scope. Currently scoped permissions cover account and academic/student records, notifications, curation, PairSpace, attachments, events, discussions and university-linked career records; company catalog and company-wide memberships, service, log and settings operations remain global-only.

## Verification

Run backend/developer tsc, root lint and repository guards. Run `node --test infrastructure/control/agent.test.mjs`; integration tests require a fresh disposable local `curation_test_*` PostgreSQL database via PLATFORM_TEST_DATABASE_URL. Simulated Docker execution is not production verification.
