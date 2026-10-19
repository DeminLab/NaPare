# Source card: Platform PairSpace announcement service

## Canonical source

`apps/backend/src/platform-pair-space/platform-pair-space.service.ts`

## Scope

Searches and reviews global PairSpace spaces and announcements, diagnoses tenant/catalog links, and corrects activity, text, or pinned state.

## Change boundary

Preserve author, lesson, group, university, and synchronization fields. Space patches may change only activity and must revalidate its tenant and lesson; keep correction and old/new audit values in one transaction.

Apply delegated university scope to both space and announcement searches, direct detail reads, and state/content corrections.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
