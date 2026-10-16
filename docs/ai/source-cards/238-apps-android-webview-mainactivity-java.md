# Source card: Android WebView Activity

## Canonical source

`apps/android-webview/app/src/main/java/ru/napare/app/MainActivity.java`

## Scope

HTTPS-only wrapper for napare.sano.ru. Cold activity creation opens login and clears only the site's two auth tokens before displaying the form. Website auth controls role routing. Native back, progress, network retry, JS confirmations, document selection and origin-scoped calendar save are implemented. External HTTPS/mail/tel/MAX links leave the WebView. No native push, camera or arbitrary JavaScriptInterface.

Version 1.1.1 removes the bottom native toolbar and its Offline Plan/About buttons at the user's request. WebView fills the available area within system/keyboard insets. Offline plan source and previously stored data remain, but there is no launcher in the current UI. Version 1.1.0 store drafts are historical and require revision before submission.

## Read sequence

1. [Android README](../../../apps/android-webview/README.md).
2. Activity, AndroidManifest.xml, app/build.gradle and settings.gradle.
3. [Mobile client](../../clients/mobile.md), website login and Android build script.

## Change boundary

Preserve the exact HTTPS host allowlist, normal TLS validation and disabled file/content access. Do not place signing credentials, APKs, local SDK paths or generated Gradle/build output in Git. Do not report a build as device/runtime proof.

## Verification

`assembleRelease`, `lintRelease`, APK signature verification, then device login/navigation/network/file checks listed in the Android README.
