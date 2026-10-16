# Source card: `packages/ui/src/Curation.tsx`

## Canonical source

`packages/ui/src/Curation.tsx`

## Scope

Shared curation workspace for student, staff and deanery apps; context discovery, assignments, roster, schedule, scoped absence decisions and paginated lists.

The October 16 revision uses semantic controls from `packages/ui/content-styles.css`, native mobile group selection and compact tabs. Group search is shown for more than ten results or an active query. `useCurationContext` supplies conditional role navigation after account loading; the optional `CurationEntry` remains available but is no longer repeated above every page. API paths and mutation behavior are unchanged.

## Change boundary

Read [account curatorship](../../product/account-curatorship.md) and direct callers. Preserve primary roles, existing sessions, tenant/group checks and audit history. UI visibility is not authorization.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```

For integration tests, use only a fresh disposable local `curation_test_*` database. A skipped test is not runtime proof.
