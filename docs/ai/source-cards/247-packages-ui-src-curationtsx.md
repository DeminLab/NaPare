# Source card: `packages/ui/src/Curation.tsx`

## Canonical source

`packages/ui/src/Curation.tsx`

## Scope

Shared curation workspace for student, staff and deanery apps; context discovery, assignments, roster, schedule, scoped absence decisions and paginated lists.

## Change boundary

Read [account curatorship](../../product/account-curatorship.md) and direct callers. Preserve primary roles, existing sessions, tenant/group checks and audit history. UI visibility is not authorization.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```

For integration tests, use only a fresh disposable local `curation_test_*` database. A skipped test is not runtime proof.
