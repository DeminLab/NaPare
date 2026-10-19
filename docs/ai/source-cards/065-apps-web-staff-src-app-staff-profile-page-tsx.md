# Source card: `apps/web-staff/src/app/(staff)/profile/page.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/profile/page.tsx`

## Scope

Staff profile displays the actual role and available groups from attendance-groups. Technical UUIDs are not presented as university names. Account connections use a root-level link to the shared portal. Profile, group and activity loading states are announced through the shared `LoadingState` primitive.

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

