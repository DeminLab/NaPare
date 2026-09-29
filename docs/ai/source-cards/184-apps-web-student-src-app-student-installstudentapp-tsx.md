# Source card: `apps/web-student/src/app/(student)/InstallStudentApp.tsx`

## Canonical source

`apps/web-student/src/app/(student)/InstallStudentApp.tsx`

## Scope

Provides browser install prompting and manual home-screen guidance for iOS and other browsers.

## Read sequence

1. Read the component and its use on Student settings.
2. Check the root manifest metadata and Student service-worker registration.

## Change boundary

Keep install guidance truthful to browser capabilities; do not imply native app or push support.

## Verification

```powershell
pnpm --filter @napare/web-student exec tsc --noEmit
```
