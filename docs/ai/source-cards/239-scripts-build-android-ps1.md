# Source card: Android release build

## Canonical source

`scripts/build-android.ps1`

## Scope

Builds the independent Android Gradle project, runs release lint, verifies the APK signature and copies the installable artifact into ignored output. Signing JSON, keystore and passwords are supplied from outside Git; process environment is restored after the run.

## Read sequence

Read the Android README, this script, app/build.gradle and the Gradle wrapper configuration.

## Change boundary

Never print signing credentials or commit signing JSON/keystores. Keep the update key stable. Increase versionCode for a subsequent app release. Website deployment is separate from APK delivery.

## Verification

Run this script with local Java 17, Android SDK 35 and a private signing configuration; inspect the resulting manifest/signature and test installation on a device.
