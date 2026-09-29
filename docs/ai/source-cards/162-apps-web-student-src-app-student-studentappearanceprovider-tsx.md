# Source card: `apps/web-student/src/app/(student)/StudentAppearanceProvider.tsx`

## Canonical source

`apps/web-student/src/app/(student)/StudentAppearanceProvider.tsx`

## Scope

Applies locally saved light/dark/system theme, accent color, and compact mode to the document root for the complete student workspace. Listens for same-tab settings updates, cross-tab storage changes, and system color preference changes.

## Read sequence

1. Read the student settings route source card.
2. Read this provider and `apps/web-student/src/app/globals.css`.

## Change boundary

Keep preferences local to the student app and scope visual rules to student workspace content. Respect system color changes only when the user selected the system theme.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```
