# Source card: Platform homework service

## Canonical source

`apps/backend/src/platform-homework/platform-homework.service.ts`

## Scope

Searches and details homework submissions, validates their lesson and university relationships, applies corrections, and records read and write audit entries.

## Change boundary

Require `homework-data.read` or `homework-data.write` on the server. Apply delegated university scope to searches and check the canonical university derived from the homework's pair space before revealing or correcting a submission. Corrections are transactional, reasoned, and limited to submission status, time, file URL, and comment; do not add grades here.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
