# Source card: `apps/web-staff/src/app/(staff)/today/page.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/today/page.tsx`

## Scope

Current role-aware home: reviewers see absence queue and groups first; teachers see their next lesson, attendance and materials. The day list and recent events remain compact, tutorial banners and duplicate metric cards are removed. Counts distinguish unavailable requests from zero. Existing API contracts are preserved.

Attention counts use actual open inbox items. Absence counts come from the pending queue metadata; no faculty-wide totals are inferred from personal lessons. The upcoming lesson and daily schedule rows show the shared lesson-type badge. Recent events link to the notifications list.

The quick link to preparation is always visible so work attached to a future lesson remains reachable even when the daily `/my-day` payload has no homework. The preparation count still reflects only homework included in that daily payload. The initial day view waits for the profile and `/my-day`; notifications, inbox, curation access and review counts update independently after the main content appears.

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

