# Source card: `apps/web-student/src/app/(student)/CurationAccess.tsx`

## Canonical source

`apps/web-student/src/app/(student)/CurationAccess.tsx`

## Scope

Client entry for additional curation assignments, outside protected navigation/header components.

## Change boundary

Read [account curatorship](../../product/account-curatorship.md) and direct callers. Preserve primary roles, existing sessions, tenant/group checks and audit history. UI visibility is not authorization.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```

For integration tests, use only a fresh disposable local `curation_test_*` database. A skipped test is not runtime proof.
