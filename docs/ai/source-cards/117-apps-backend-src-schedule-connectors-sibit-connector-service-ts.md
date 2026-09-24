# Source card: `apps/backend/src/schedule/connectors/sibit-connector.service.ts`

## Canonical source

`apps/backend/src/schedule/connectors/sibit-connector.service.ts`

## Scope

NestJS backend module, HTTP boundary, authorization or data-service behavior.

## Read sequence

1. Start with [AI context](../../../AI_CONTEXT.md) and the relevant role or backend map.
2. Read this canonical source file.
3. Trace direct imports and its nearest caller before widening the investigation.

## Change boundary

Trace consumers and tests before changing data or authorization behavior. The connector maps `RaspScraperService` records from rasp.sano.ru into `CreateLessonDto`; `AdminService.syncSchedule` is its caller.

## Verification

```powershell
pnpm --filter @napare/backend exec jest src/schedule/connectors/sibit-connector.service.spec.ts
pnpm --filter @napare/backend exec tsc --noEmit
```
