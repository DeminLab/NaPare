# Source card: `apps/backend/src/common/tenant/tenant-context.spec.ts`

## Canonical source

`apps/backend/src/common/tenant/tenant-context.spec.ts`

## Scope

University access tests plus asynchronous guard propagation and concurrent request isolation regressions.

## Read sequence

1. Read [change safety](../change-safety.md).
2. Read TenantContextModule and JwtAuthGuard together with this source.

## Change boundary

Preserve authentication, university scope and request isolation.

## Verification

```powershell
pnpm --filter @napare/backend exec jest --runInBand tenant-context.spec.ts
pnpm --filter @napare/backend exec tsc --noEmit
```
