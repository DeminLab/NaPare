param(
    [Parameter(Mandatory=$true)][string]$AndroidSdk,
    [Parameter(Mandatory=$true)][string]$JavaHome,
    [Parameter(Mandatory=$true)][string]$SigningConfigPath,
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '../outputs/android')
)
$ErrorActionPreference = 'Stop'
$androidProject = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../apps/android-webview'))
$androidSigning = Get-Content -LiteralPath $SigningConfigPath -Raw | ConvertFrom-Json
if (!(Test-Path -LiteralPath $androidSigning.store)) { throw 'Signing keystore not found' }
if (!(Test-Path -LiteralPath (Join-Path $AndroidSdk 'platforms/android-35/android.jar'))) { throw 'Android SDK platform 35 is required' }
$androidEnvironment = @{
    JAVA_HOME = $JavaHome
    ANDROID_HOME = $AndroidSdk
    NAPARE_SIGNING_STORE = $androidSigning.store
    NAPARE_SIGNING_PASSWORD = $androidSigning.password
    NAPARE_SIGNING_ALIAS = $androidSigning.alias
}
$androidPrevious = @{}
try {
    foreach ($androidName in $androidEnvironment.Keys) {
        $androidPrevious[$androidName] = [Environment]::GetEnvironmentVariable($androidName, 'Process')
        [Environment]::SetEnvironmentVariable($androidName, $androidEnvironment[$androidName], 'Process')
    }
    Push-Location $androidProject
    try {
        & ./gradlew.bat --no-daemon assembleRelease lintRelease
        if ($LASTEXITCODE -ne 0) { throw 'Android build failed' }
        $androidApk = Join-Path $androidProject 'app/build/outputs/apk/release/app-release.apk'
        & (Join-Path $AndroidSdk 'build-tools/35.0.0/apksigner.bat') verify --verbose $androidApk
        if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed' }
        New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
        $androidArtifact = Join-Path $OutputDirectory 'NaPare-1.0.0.apk'
        Copy-Item -LiteralPath $androidApk -Destination $androidArtifact
        Get-FileHash -LiteralPath $androidArtifact -Algorithm SHA256
    } finally { Pop-Location }
} finally {
    foreach ($androidName in $androidPrevious.Keys) {
        [Environment]::SetEnvironmentVariable($androidName, $androidPrevious[$androidName], 'Process')
    }
}
