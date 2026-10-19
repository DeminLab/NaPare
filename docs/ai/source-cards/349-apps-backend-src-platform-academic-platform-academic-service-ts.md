# Source card: Platform academic service

## Canonical source

`apps/backend/src/platform-academic/platform-academic.service.ts`

## Scope

Searches and reviews lesson occurrences within the caller's delegated university scope (or globally for the owner), edits manually managed occurrences, writes schedule history and audit data atomically, and publishes the corresponding academic event.

## Change boundary

Apply delegated university scope to list, detail, and update using the occurrence's canonical universityId. Keep imported occurrences read-only; verify university, course, series, group, and teacher relationships before changes.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
