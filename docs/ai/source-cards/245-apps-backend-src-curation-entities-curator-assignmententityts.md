# Source card: `apps/backend/src/curation/entities/curator-assignment.entity.ts`

## Canonical source

`apps/backend/src/curation/entities/curator-assignment.entity.ts`

## Scope

Many-to-many curator assignment with a unique active pair and preserved grant/revoke history.

## Change boundary

Read [account curatorship](../../product/account-curatorship.md) and direct callers. Preserve primary roles, existing sessions, tenant/group checks and audit history. UI visibility is not authorization.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

For integration tests, use only a fresh disposable local `curation_test_*` database. A skipped test is not runtime proof.
