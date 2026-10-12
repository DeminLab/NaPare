# Source card: `apps/web-developer/src/app/page.tsx`

## Canonical source

`apps/web-developer/src/app/page.tsx`

## Scope

Developer root redirects to the authenticated API workspace. Next configuration skips automatic trailing slash redirection to avoid a loop with the existing Nginx /developer to /developer/ redirect.

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

