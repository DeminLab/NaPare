# Source card: `packages/ui/src/Curation.tsx`

## Canonical source

`packages/ui/src/Curation.tsx`

## Scope

Shared curation workspace for student, staff and deanery apps; context discovery, assignments, roster, schedule with shared lesson-type badges, scoped absence decisions and paginated lists.

The October 16 revision uses semantic controls from `packages/ui/content-styles.css`, native mobile group selection and compact tabs. Group search is shown for more than ten results or an active query. `useCurationContext` supplies conditional role navigation after account loading; the optional `CurationEntry` remains available but is no longer repeated above every page. API paths and mutation behavior are unchanged.

The October 18 UX-47 refinement disables stale group selection immediately on query change while preserving the search control during debounce/loading, and returns keyboard focus to the decision action when its inline form is cancelled. Group-list load errors include a local retry action. Decision mutation contracts are unchanged. `showCounts` is opt-in and remains enabled only by callers that request it.

## Change boundary

Read [account curatorship](../../product/account-curatorship.md) and direct callers. Preserve primary roles, existing sessions, tenant/group checks and audit history. UI visibility is not authorization.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```

For integration tests, use only a fresh disposable local `curation_test_*` database. A skipped test is not runtime proof.

UX-47: student/staff TypeScript, focused ESLint, root lint, `lint:docs`, AI docs validator and role boundary guard passed. Synthetic browser verified group selection, opening the decision form and restoring focus to “Подтвердить” after cancel. It did not verify delayed stale-result disabling, mobile select, screen reader, real API or production session. The temporary route was removed and staff `next typegen`/TypeScript passed; its dev-only `/favicon.ico` request returned 404 under the harness basePath. Detailed evidence is in `docs/UX_REDESIGN_GOAL.md`.
