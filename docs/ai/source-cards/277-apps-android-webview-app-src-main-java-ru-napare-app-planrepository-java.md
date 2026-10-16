# Source card: `apps/android-webview/app/src/main/java/ru/napare/app/PlanRepository.java`

## Canonical source

`apps/android-webview/app/src/main/java/ru/napare/app/PlanRepository.java`

## Scope

Android release candidate and manual native offline organizer. Read [Android README](../../../apps/android-webview/README.md) and [RuStore release procedure](../../deployment/rustore-publication.md). Preserve the website authentication boundary, private device storage, atomic plan writes, stable signing certificate and explicit publication blockers. Native plans do not synchronize with university records or accounts. Never put reviewer passwords or signing keys in Git.

## Verification

Run signed assembleRelease, lintRelease, testReleaseUnitTest through scripts/build-android.ps1 and inspect the APK manifest/signature. Device/emulator tests and genuine store screenshots remain separate from JVM/build checks.
