# Source card: `apps/web-staff/src/app/(staff)/settings/page.tsx`

## Canonical source

`apps/web-staff/src/app/(staff)/settings/page.tsx`

## Scope

Staff settings use real notification preferences and Telegram account status, explicit saving and error recovery, plus profile and account connection links. Fake settings tabs were removed.

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

