# Source card: `apps/web-staff/src/app/(staff)/pair-space/page.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/pair-space/page.tsx`

## Scope

Searchable list of role-scoped lessons from the preceding week and next two weeks. All API pages are loaded so search covers the full period; the query is preserved in the URL. Recent and upcoming lessons lead directly to their workspaces using the existing schedule API. Loading, empty search and request failure are distinct states.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the relevant role or backend map.
2. Read this canonical source file.
3. Trace direct imports and its nearest caller before widening the investigation.

## Change boundary

Trace direct imports and the closest route or caller before changing this file.

## Verification

```powershell
pnpm --filter @napare/web-staff exec tsc --noEmit
```

UX-50 synthetic browser evidence: imported the actual page and intercepted schedule API. Verified 101 lessons over two pages, local search stored in `q` and restored after reload, page-two HTTP 503 without partial links, successful retry restoring all 101 records, opening lesson 101 and returning with the in-page Back button, and no horizontal overflow at 320/768/1024/1440. Development React StrictMode duplicated some request calls; assertions covered the visible results rather than call counts. The temporary harness route was removed; `next typegen`/TypeScript had passed after the original source change. Real API, authorization, screen-reader behavior and production remain unverified; see `docs/UX_REDESIGN_GOAL.md`.

