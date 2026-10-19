# Source card: Platform academic event service

## Canonical source

`apps/backend/src/platform-academic/platform-academic-events.service.ts`

## Scope

Searches and audits domain events within the caller's delegated university scope (or globally for the owner), returns safe projections, and supports reasoned correction and reversible visibility changes.

## Change boundary

Apply delegated university scope to list, detail, correction, hide, and restore using the event's canonical universityId. Never return arbitrary event payloads; linked occurrences and externally sourced events are read-only for correction.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
