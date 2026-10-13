# Source card: `apps/web-staff/src/lib/api.ts`

## Canonical source

`apps/web-staff/src/lib/api.ts`

## Scope

Staff workspace UI and its data flow.

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


## Empty mutation responses

The staff client accepts successful empty bodies, including after token refresh, without reporting a JSON parse error. Invalid nonempty JSON is rejected. Regression check: set `NAPARE_API_TEST_APP=staff` and run `node scripts/test-workspace-api.cjs`.
