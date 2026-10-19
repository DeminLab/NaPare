# Source card: Platform events module

## Canonical source

`apps/backend/src/platform-events/platform-events.module.ts`

## Scope

Registers the read-only platform event controller, service, event records, universities and audit repository.

## Change boundary

Keep event access behind the platform permission guard and avoid exposing recipient or secret fields.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
