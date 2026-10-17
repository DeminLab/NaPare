# Source card: Platform career service

## Canonical source

`apps/backend/src/platform-career/platform-career.service.ts`

## Scope

Searches, reads, corrects and reviews student career profiles and admission requests across universities.

## Change boundary

Private fields are returned only from audited detail reads. Mutations use transactions and row locks, validate the linked student and university, require a reason and write old/new values to the career-scoped audit entity.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
