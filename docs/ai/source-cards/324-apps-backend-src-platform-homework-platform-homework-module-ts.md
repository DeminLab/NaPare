# Source card: Platform homework module

## Canonical source

`apps/backend/src/platform-homework/platform-homework.module.ts`

## Scope

Registers the platform homework controller and service with the submission, homework, lesson, university, user, and audit repositories.

## Change boundary

Keep the module scoped to domain-specific submission administration and its required data sources.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
