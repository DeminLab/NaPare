# Source card: Platform career DTO

## Canonical source

`apps/backend/src/platform-career/platform-career.dto.ts`

## Scope

Validates career search filters, profile/admission corrections, company edits, partnership decisions, task draft corrections, membership management, test editing, portfolio moderation, review corrections, notice edits and availability corrections for platform administration.

## Change boundary

Keep field allowlists, length limits and legal status values aligned with the career domain entities and transitions.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
