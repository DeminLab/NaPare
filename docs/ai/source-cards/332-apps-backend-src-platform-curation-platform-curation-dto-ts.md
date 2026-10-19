# Source card: Platform curation DTOs

## Canonical source

`apps/backend/src/platform-curation/platform-curation.dto.ts`

## Scope

Validates paginated global assignment, group, and candidate searches, university scoping, assignment grants, and revocation reasons.

## Change boundary

Keep read and write payloads explicit. Grant and revoke require a human-readable reason.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
