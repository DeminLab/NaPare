# Source card: Platform career operations DTO

## Canonical source

`apps/backend/src/platform-career/platform-career-operations.dto.ts`

## Scope

Validates filters, bounded content corrections, candidate decisions and submitted work decisions.

## Change boundary

Only `selected`/`not_selected` and `accepted`/`revision` transitions are exposed. Result links receive the career domain's HTTPS validation.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
