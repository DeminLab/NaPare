# Source card: `apps/web-student/src/app/(student)/schedule-location.ts`

## Canonical source

`apps/web-student/src/app/(student)/schedule-location.ts`

## Scope

Formats a schedule location from the available building and room fields for student Today, week, month, and calendar export views.

## Read sequence

1. Read [the Schedule module](../../modules/schedule.md).
2. Read this formatter and the student schedule routes that consume it.

## Change boundary

Treat building and room as optional source data; never invent a building or room when the connector does not provide one.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```
