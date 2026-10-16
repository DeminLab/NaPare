# Source card: `apps/web-staff/src/app/(staff)/groups/page.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/groups/page.tsx`

## Scope

Accessible groups with URL search/faculty state and shared Sheet details. Student roster and schedule failures are independent. Week links pass group ID; preparation links carry group name search; nearest lesson and group schedule entries show the shared lesson-type badge.

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

