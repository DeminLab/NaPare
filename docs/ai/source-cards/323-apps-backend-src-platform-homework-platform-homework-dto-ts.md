# Source card: Platform homework DTOs

## Canonical source

`apps/backend/src/platform-homework/platform-homework.dto.ts`

## Scope

Validates global submission search filters and correction fields, including the supported submission states and required correction reason.

## Change boundary

Keep status and field validation aligned with the submission workflow. The correction contract contains no grade field.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
