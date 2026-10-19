# Source card: `apps/web-developer/src/app/(developer)/control/SettingsPanel.tsx`

## Canonical source

`apps/web-developer/src/app/(developer)/control/SettingsPanel.tsx`

## Scope

Owner-bound platform control and explicitly delegated capabilities. Read [implementation](../../product/platform-control.md) and [installation](../../deployment/platform-control.md) before changes. Preserve immutable owner identity, server-side permission checks and private signed agent transport.

The maintenance-mode confirmation and cancel controls are `type="button"` inside the form, preventing their click handlers from also triggering its submit handler. The primary save control remains `type="submit"`.

## Verification

Run backend/developer tsc, root lint and repository guards. Run `node --test infrastructure/control/agent.test.mjs`; integration tests require a fresh disposable local `curation_test_*` PostgreSQL database via PLATFORM_TEST_DATABASE_URL. Simulated Docker execution is not production verification.
