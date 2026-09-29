# Source card: `apps/web-admin/src/app/(admin)/layout.tsx`

## Canonical source

`apps/web-admin/src/app/(admin)/layout.tsx`

## Scope

University administration workspace shell and navigation. Its «Подключения аккаунта» item uses a same-origin browser link to the shared portal page so the `/deanery` base path is not applied to `/connections`.

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

