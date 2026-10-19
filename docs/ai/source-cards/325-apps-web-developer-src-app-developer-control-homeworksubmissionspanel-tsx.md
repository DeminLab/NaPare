# Source card: Developer homework submissions panel

## Canonical source

`apps/web-developer/src/app/(developer)/control/HomeworkSubmissionsPanel.tsx`

## Scope

Developer-control interface for searching homework submissions, reviewing audited details, and correcting a submission with a reason.

## Change boundary

Show correction controls only with `homework-data.write`; the backend remains authoritative for read/write access. The panel edits submission status, date, attachment URL, and comment, without grading.

## Verification

```powershell
pnpm --filter @napare/web-developer exec tsc --noEmit
```
