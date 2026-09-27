# Source card: `apps/backend/src/moodle/moodle-connector.service.ts`

## Canonical source

`apps/backend/src/moodle/moodle-connector.service.ts`

## Scope

Moodle Web Services boundary, token encryption and connection verification.

## Change boundary

Use HTTPS only, retain AES-256-GCM encryption, and never log or return the Web Services token. Moodle is the source of truth for submissions and grades.

## Verification

```powershell
pnpm --filter @napare/backend exec jest src/moodle/moodle-connector.service.spec.ts --runInBand --forceExit
pnpm --filter @napare/backend exec tsc --noEmit
```
