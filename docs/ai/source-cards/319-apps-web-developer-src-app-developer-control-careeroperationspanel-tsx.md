# Source card: Developer career operations panel

## Canonical source

`apps/web-developer/src/app/(developer)/control/CareerOperationsPanel.tsx`

## Scope

Global application and work queues with detail, correction, candidate choice, rejection, work acceptance and revision request.

## Change boundary

Buttons follow the career workflow states and require a reason. Read and write visibility follows the distinct platform grants.

## Verification

```powershell
pnpm --filter @napare/web-developer exec tsc --noEmit
```
