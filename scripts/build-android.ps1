param(
    [Parameter(Mandatory=$true)][string]$AndroidSdk,
    [Parameter(Mandatory=$true)][string]$JavaHome,
    [Parameter(Mandatory=$true)][string]$SigningConfigPath,
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '../outputs/android'),
    [string]$PreviousApkPath
)
$ErrorActionPreference = 'Stop'
$androidProject = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../apps/android-webview'))
$OutputDirectory = [IO.Path]::GetFullPath($OutputDirectory)
$androidSigning = Get-Content -LiteralPath $SigningConfigPath -Raw | ConvertFrom-Json
if (!(Test-Path -LiteralPath $androidSigning.store)) { throw 'Signing keystore not found' }
if (!$androidSigning.password -or !$androidSigning.alias) { throw 'Signing password and alias are required in the private config' }
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
        & ./gradlew.bat --no-daemon assembleRelease lintRelease testReleaseUnitTest
        if ($LASTEXITCODE -ne 0) { throw 'Android build failed' }
        $androidApk = Join-Path $androidProject 'app/build/outputs/apk/release/app-release.apk'
        $androidSigner = Join-Path $AndroidSdk 'build-tools/35.0.0/apksigner.bat'
        $androidSignature = & $androidSigner verify --verbose --print-certs $androidApk
        if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed' }
        $androidDigest = (($androidSignature | Select-String 'Signer #1 certificate SHA-256 digest:').ToString() -split ': ',2)[1]
        if (!$androidDigest) { throw 'Missing release certificate digest' }
        if ($PreviousApkPath) {
            $androidPreviousSignature = & $androidSigner verify --print-certs $PreviousApkPath
            if ($LASTEXITCODE -ne 0) { throw 'Previous APK signature verification failed' }
            $androidPreviousDigest = (($androidPreviousSignature | Select-String 'Signer #1 certificate SHA-256 digest:').ToString() -split ': ',2)[1]
            if ($androidDigest -ne $androidPreviousDigest) { throw 'Signing key differs from previous APK; update would not be installable' }
        }
        $androidBadging = & (Join-Path $AndroidSdk 'build-tools/35.0.0/aapt.exe') dump badging $androidApk
        if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect APK manifest' }
        $androidPackage = [regex]::Match(($androidBadging -join "`n"), "package: name='([^']+)' versionCode='([^']+)' versionName='([^']+)'")
        if (!$androidPackage.Success) { throw 'Cannot read APK identity/version' }
        $androidVersion = $androidPackage.Groups[3].Value
        New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
        $androidArtifact = Join-Path $OutputDirectory "NaPare-$androidVersion.apk"
        Copy-Item -LiteralPath $androidApk -Destination $androidArtifact
        $androidHash = (Get-FileHash -LiteralPath $androidArtifact -Algorithm SHA256).Hash
        $androidReport = [ordered]@{ apk = [IO.Path]::GetFileName($androidArtifact); applicationId = $androidPackage.Groups[1].Value; versionCode = [int]$androidPackage.Groups[2].Value; versionName = $androidVersion; sha256 = $androidHash; certificateSha256 = $androidDigest; build = 'passed'; lint = 'passed; inspect lint report warnings'; unitTests = 'passed'; deviceRuntime = 'not verified by this build script' }
        $androidReport | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $OutputDirectory 'build-result.json') -Encoding utf8
        $androidReport | ConvertTo-Json
    } finally { Pop-Location }
} finally {
    foreach ($androidName in $androidPrevious.Keys) {
        [Environment]::SetEnvironmentVariable($androidName, $androidPrevious[$androidName], 'Process')
    }
}
