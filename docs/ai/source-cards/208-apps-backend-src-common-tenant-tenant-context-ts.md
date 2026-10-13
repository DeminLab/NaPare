# Source card: `apps/backend/src/common/tenant/tenant-context.ts`

## Canonical source

`apps/backend/src/common/tenant/tenant-context.ts`

## Scope

Request-local authenticated actor and university access checks. Null university scope cannot read academic data; only employer identity may be stored without a university. Initialised by TenantContextModule before asynchronous guards; maintains existing superadmin and background-job semantics.

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
