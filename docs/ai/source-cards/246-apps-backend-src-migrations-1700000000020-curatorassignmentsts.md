# Source card: `apps/backend/src/migrations/1700000000020-CuratorAssignments.ts`

## Canonical source

`apps/backend/src/migrations/1700000000020-CuratorAssignments.ts`

## Scope

Creates assignment storage and backfills valid active same-university legacy pointers. Never infers or replaces an account role.

## Change boundary

Read [account curatorship](../../product/account-curatorship.md) and direct callers. Preserve primary roles, existing sessions, tenant/group checks and audit history. UI visibility is not authorization.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

For integration tests, use only a fresh disposable local `curation_test_*` database. A skipped test is not runtime proof.
