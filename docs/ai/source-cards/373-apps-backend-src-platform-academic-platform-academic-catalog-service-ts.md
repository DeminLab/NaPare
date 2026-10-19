# Source card: Platform academic catalog service

## Canonical source

`apps/backend/src/platform-academic/platform-academic-catalog.service.ts`

## Scope

Searches, audits, validates and updates manually managed courses and lesson series within the caller's delegated university scope (or globally for the owner), including university-scoped selector options.

## Change boundary

Apply delegated university scope to lists, details, selector options, and updates using the requested or resource's canonical universityId. Keep group, teacher and faculty links within the same university; update Course Space atomically and leave existing occurrences unchanged.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
