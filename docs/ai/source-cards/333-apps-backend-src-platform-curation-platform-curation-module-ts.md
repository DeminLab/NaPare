# Source card: Platform curation module

## Canonical source

`apps/backend/src/platform-curation/platform-curation.module.ts`

## Scope

Registers the global curator assignment controller and service with assignment, group, university, user, and audit repositories.

## Change boundary

Keep management behind the platform permission service and preserve tenant links when resolving historical assignments.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
