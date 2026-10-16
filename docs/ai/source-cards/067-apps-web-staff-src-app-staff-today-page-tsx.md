# Source card: `apps/web-staff/src/app/(staff)/today/page.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/today/page.tsx`

## Scope

Current role-aware home: reviewers see absence queue and groups first; teachers see their next lesson, attendance and materials. The day list and recent events remain compact, tutorial banners and duplicate metric cards are removed. Counts distinguish unavailable requests from zero. Existing API contracts are preserved.

Attention counts use actual open inbox items. Absence counts come from the pending queue metadata; no faculty-wide totals are inferred from personal lessons. Recent events link to the notifications list.

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

