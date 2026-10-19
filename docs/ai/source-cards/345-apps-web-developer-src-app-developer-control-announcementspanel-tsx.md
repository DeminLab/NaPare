# Source card: Developer PairSpace announcements panel

## Canonical source

`apps/web-developer/src/app/(developer)/control/AnnouncementsPanel.tsx`

## Scope

Searches announcements across universities, shows author and lesson context, and allows authorized operators to correct text or pinned state with a reason.

## Change boundary

Keep author and resource links read-only; require `pairspace-content.write` for edits.

## Verification

```powershell
pnpm --filter @napare/web-developer exec tsc --noEmit
```
