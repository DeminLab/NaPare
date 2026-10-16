# Source card: `apps/web-admin/src/app/(admin)/curation/page.tsx`

## Canonical source

`apps/web-admin/src/app/(admin)/curation/page.tsx`

## Scope

Curation management in the existing deanery/admin base path.

## Change boundary

Read [account curatorship](../../product/account-curatorship.md) and direct callers. Preserve primary roles, existing sessions, tenant/group checks and audit history. UI visibility is not authorization.

## Verification

```powershell
pnpm --filter @napare/web-admin exec tsc --noEmit
```

For integration tests, use only a fresh disposable local `curation_test_*` database. A skipped test is not runtime proof.
