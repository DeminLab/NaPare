# Source card: `apps/backend/src/pair-space/dto/upsert-personal-note.dto.ts`

## Canonical source

`apps/backend/src/pair-space/dto/upsert-personal-note.dto.ts`

## Scope

Validates personal lesson note content and caps each note at 20,000 characters.

## Read sequence

1. Read [the Pair Space module](../../modules/pair-space.md).
2. Follow the DTO to the `PUT /pair-spaces/:lessonId/personal-note` controller route.

## Change boundary

Do not accept owner or tenant IDs from the request body; both come from the authenticated account and authorized lesson.

## Verification

```powershell
pnpm --filter @napare/backend exec tsc --noEmit
```
