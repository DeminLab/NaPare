# Source card: `apps/web-staff/src/app/(staff)/curation/page.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/curation/page.tsx`

## Scope

Staff curation workspace and deanery assignment management using the shared UI.

## Change boundary

Read [account curatorship](../../product/account-curatorship.md) and direct callers. Preserve primary roles, existing sessions, tenant/group checks and audit history. UI visibility is not authorization.

## Verification

```powershell
pnpm --filter @napare/web-staff exec tsc --noEmit
```

For integration tests, use only a fresh disposable local `curation_test_*` database. A skipped test is not runtime proof.
