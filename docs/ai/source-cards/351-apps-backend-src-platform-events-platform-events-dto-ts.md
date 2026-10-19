# Source card: Platform events DTO

## Canonical source

`apps/backend/src/platform-events/platform-events.dto.ts`

## Scope

Validates global system-event search filters, including university, type, date range and priority.

## Change boundary

Keep filters bounded and reject unknown query parameters through the global validation pipe.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
