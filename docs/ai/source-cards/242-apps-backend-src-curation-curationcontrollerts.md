# Source card: `apps/backend/src/curation/curation.controller.ts`

## Canonical source

`apps/backend/src/curation/curation.controller.ts`

## Scope

Authenticated curation endpoints. Manager and resource checks live in CurationService; no primary role replacement.

## Change boundary

Read [account curatorship](../../product/account-curatorship.md) and direct callers. Preserve primary roles, existing sessions, tenant/group checks and audit history. UI visibility is not authorization.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

For integration tests, use only a fresh disposable local `curation_test_*` database. A skipped test is not runtime proof.
