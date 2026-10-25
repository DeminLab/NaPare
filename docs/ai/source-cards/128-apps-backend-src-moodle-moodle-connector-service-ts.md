# Source card: `apps/backend/src/moodle/moodle-connector.service.ts`

## Canonical source

`apps/backend/src/moodle/moodle-connector.service.ts`

## Scope

Moodle Web Services boundary, token encryption and connection verification.

Also reads explicit-user enrollments and a single exact student/course grade report; rejects mismatched reports, warnings and oversized responses. See [semester API](../../integrations/moodle-semester.md).

## Change boundary

Use HTTPS only, retain AES-256-GCM encryption, and never log or return the Web Services token. Moodle is the source of truth for submissions and grades.

## Verification

```powershell
pnpm --filter @napare/backend exec jest src/moodle/moodle-connector.service.spec.ts --runInBand --forceExit
pnpm --filter @napare/backend exec tsc --noEmit
```
