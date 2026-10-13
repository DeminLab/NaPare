# Source card: `apps/web-developer/src/app/(developer)/overview/page.tsx`

## Canonical source

`apps/web-developer/src/app/(developer)/overview/page.tsx`

## Scope

Developer operations overview with per-request availability, explicit missing telemetry, check timestamp and retry. Notifications accept list or paginated data responses.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the relevant role or backend map.
2. Read this canonical source file.
3. Trace direct imports and its nearest caller before widening the investigation.

## Change boundary

Trace direct imports and the closest route or caller before changing this file.

## Verification

```powershell
pnpm --filter @napare/web-developer exec tsc --noEmit
```

