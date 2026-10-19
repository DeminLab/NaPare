# Source card: `apps/web-developer/src/app/(developer)/docs/page.tsx`

## Canonical source

`apps/web-developer/src/app/(developer)/docs/page.tsx`

## Scope

Developer API documentation derives the base URL from the current browser origin, provides working section anchors and language examples, handles clipboard failure and links to real Swagger. Token values are never included in examples. Its search status remains mounted for accessible announcements when a query changes or is cleared.

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

