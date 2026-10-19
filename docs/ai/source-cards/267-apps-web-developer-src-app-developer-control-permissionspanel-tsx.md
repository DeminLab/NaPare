# Source card: `apps/web-developer/src/app/(developer)/control/PermissionsPanel.tsx`

## Canonical source

`apps/web-developer/src/app/(developer)/control/PermissionsPanel.tsx`

## Scope

Owner-only trust controls include the explicit DevOps full-operations preset and emergency grant/session revocation with current-password and typed confirmation. Preset selection is saved explicitly.

Owner-bound platform control and explicitly delegated capabilities. Read [implementation](../../product/platform-control.md) and [installation](../../deployment/platform-control.md) before changes. Preserve immutable owner identity, server-side permission checks and private signed agent transport.

The owner can choose global, selected-university, or empty scope for each grant. The panel sends the scope explicitly, paginates the full university list, and describes the permissions accepted with a limited scope: accounts/structure, student and academic records, personal records, homework, notifications, curation, QR sessions, PairSpace, attachments, system events, discussions and university-linked career records. Company-wide administration remains global-only.

## Verification

Run backend/developer tsc, root lint and repository guards. Run `node --test infrastructure/control/agent.test.mjs`; integration tests require a fresh disposable local `curation_test_*` PostgreSQL database via PLATFORM_TEST_DATABASE_URL. Simulated Docker execution is not production verification.
