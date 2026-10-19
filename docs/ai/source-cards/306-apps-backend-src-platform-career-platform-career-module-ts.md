# Source card: Platform career module

## Canonical source

`apps/backend/src/platform-career/platform-career.module.ts`

## Scope

Registers career profile/admission moderation, company and partnership catalog access, and career application/workflow routes with the repositories used by both services.

## Change boundary

The module depends on `PlatformModule` for owner-managed permissions and does not introduce direct table editing or a generic data API.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
