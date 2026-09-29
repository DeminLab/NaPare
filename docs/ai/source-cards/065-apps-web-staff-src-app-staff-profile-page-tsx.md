# Source card: `apps/web-staff/src/app/(staff)/profile/page.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/profile/page.tsx`

## Scope

Staff profile overview and its data flow; current-week schedule counts include the full Monday-to-Sunday range with local date formatting, and the security tab links to the shared Telegram account-connection page.

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

