# Source card: Developer academic events panel

## Canonical source

`apps/web-developer/src/app/(developer)/control/AcademicEventsPanel.tsx`

## Scope

Searches domain academic events, shows safe details and history, and corrects or reversibly hides events with a required reason.

## Change boundary

Keep occurrence-linked and imported event records read-only and do not expose event payload data.

## Verification

```powershell
pnpm --filter @napare/web-developer exec tsc --noEmit
```
