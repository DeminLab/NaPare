# Source card: Platform attachments service

## Canonical source

`apps/backend/src/platform-attachments/platform-attachments.service.ts`

## Scope

Searches attachment metadata, validates resource relationships, sanitizes URLs and audits reads and reversible moderation.

## Change boundary

Never fetch external URLs or expose URL credentials, query strings or fragments. Do not delete physical files.

Searches, detail reads, revoke, and restore enforce the delegated university scope through the owning PairSpace.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
