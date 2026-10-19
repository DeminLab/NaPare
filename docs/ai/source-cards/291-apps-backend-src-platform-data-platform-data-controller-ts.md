# Source card: `apps/backend/src/platform-data/platform-data.controller.ts`

## Canonical source

`apps/backend/src/platform-data/platform-data.controller.ts`

## Scope

Global search and controlled changes to student absences, attendance, and absence-confirmation decisions. Confirmation decisions have list, detail, and correction routes.

## Change boundary

Keep server-side `student-data.read/write` checks and resource-reference checks authoritative. Pass request IP and user-agent to audit for detail views and reasoned corrections.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
