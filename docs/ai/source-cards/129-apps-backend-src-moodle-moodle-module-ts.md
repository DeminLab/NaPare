# Source card: `apps/backend/src/moodle/moodle.module.ts`

## Canonical source

`apps/backend/src/moodle/moodle.module.ts`

## Scope

NestJS provider module for Moodle connector services.

## Change boundary

Keep the export limited to `MoodleConnectorService`; callers must preserve tenant checks in their own module.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
