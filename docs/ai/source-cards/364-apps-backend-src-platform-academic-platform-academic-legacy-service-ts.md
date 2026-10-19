# Source card: Platform legacy academic service

## Canonical source

`apps/backend/src/platform-academic/platform-academic-legacy.service.ts`

## Scope

Searches legacy lessons within the caller's delegated university scope (or globally for the owner), checks academic resource relationships, audits access, and records manual corrections in schedule history.

## Change boundary

Apply delegated university scope to list, detail, and update using the lesson's canonical universityId. Keep imported lessons read-only, validate university/resource links, and persist the lesson change, schedule change, and audit atomically.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
