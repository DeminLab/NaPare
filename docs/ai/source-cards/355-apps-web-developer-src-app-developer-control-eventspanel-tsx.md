# Source card: Developer events panel

## Canonical source

`apps/web-developer/src/app/(developer)/control/EventsPanel.tsx`

## Scope

Provides searchable, paginated system events with university, date and priority filters.

## Change boundary

Keep the viewer read-only and render only the safe API response fields.

## Verification

```powershell
pnpm --filter @napare/web-developer exec tsc --noEmit
```
