# Source card: Platform PairSpace module

## Canonical source

`apps/backend/src/platform-pair-space/platform-pair-space.module.ts`

## Scope

Registers PairSpace and announcement management with academic catalog relations and child record entities for scoped diagnostics.

## Change boundary

Keep the module behind dedicated platform permissions and preserve existing PairSpace API behavior.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
