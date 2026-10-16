# Source card: `apps/backend/src/curation/curation.service.ts`

## Canonical source

`apps/backend/src/curation/curation.service.ts`

## Scope

Assignment-based authorization, tenant/group scoping, grant/revoke history, transactional absence decisions and assigned notification recipients.

## Change boundary

Read [account curatorship](../../product/account-curatorship.md) and direct callers. Preserve primary roles, existing sessions, tenant/group checks and audit history. UI visibility is not authorization.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```

For integration tests, use only a fresh disposable local `curation_test_*` database. A skipped test is not runtime proof.
