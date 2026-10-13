# Source card: `apps/web-admin/src/app/(admin)/schedule-import/page.tsx`

## Canonical source

`apps/web-admin/src/app/(admin)/schedule-import/page.tsx`

## Scope

CSV/JSON import wizard: real date/time validation, duplicate slots, numbered issues, explicit 1000-record limit, mobile previews and retry through the existing upload contract.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the relevant role or backend map.
2. Read this canonical source file.
3. Trace direct imports and its nearest caller before widening the investigation.

## Change boundary

Trace direct imports and the closest route or caller before changing this file.

## Verification

```powershell
pnpm --filter @napare/web-admin exec tsc --noEmit
```

