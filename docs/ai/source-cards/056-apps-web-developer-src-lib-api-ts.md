# Source card: `apps/web-developer/src/lib/api.ts`

## Canonical source

`apps/web-developer/src/lib/api.ts`

## Scope

Developer operations workspace UI and its data flow.

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


## Empty successful responses

Successful empty 200/201 and 204 responses return undefined. Nonempty malformed JSON remains an error. Notification read endpoints return no body; this is a successful action. Regression checks: `node scripts/test-workspace-api.cjs` and the developer variant with `NAPARE_API_TEST_APP=developer`.
