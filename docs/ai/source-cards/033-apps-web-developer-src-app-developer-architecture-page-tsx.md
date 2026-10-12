# Source card: `apps/web-developer/src/app/(developer)/architecture/page.tsx`

## Canonical source

`apps/web-developer/src/app/(developer)/architecture/page.tsx`

## Scope

Interactive architecture map describes current workspace routes, Next.js 15 and optional external integrations. The diagram is documentation and does not claim live service health.

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

