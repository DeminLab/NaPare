[CmdletBinding()]
param([switch]$StartTestDatabase, [switch]$Smoke, [string]$EccSourceRepo)
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
Push-Location $repoRoot
try {
    $nodeVersion = & node --version
    if ($LASTEXITCODE -ne 0 -or [version]$nodeVersion.TrimStart('v') -lt [version]'22.5.0') {
        throw 'DevKit runtime requires Node >=22.5; Node 24 LTS is recommended.'
    }
    $pythonCommand = if (Get-Command py -ErrorAction SilentlyContinue) { 'py' } elseif (Get-Command python3 -ErrorAction SilentlyContinue) { 'python3' } else { 'python' }
    $npmCommand = if ($IsWindows -or $env:OS -eq 'Windows_NT') { 'npm.cmd' } else { 'npm' }
    & $npmCommand ci --prefix scripts/ai-devkit/runtime --ignore-scripts --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { throw 'Pinned runtime installation failed.' }
    & $pythonCommand scripts/ai-devkit/install-vendor-skills.py
    if ($LASTEXITCODE -ne 0) { throw 'Vendor skill installation failed; existing files were preserved.' }
    if ($EccSourceRepo) {
        & $pythonCommand scripts/ai-devkit/install-ecc.py --source-repo $EccSourceRepo
        if ($LASTEXITCODE -ne 0) { throw 'ECC project installation failed.' }
    }
    if ($StartTestDatabase) {
        & $pythonCommand scripts/ai-devkit/test-database.py start
        if ($LASTEXITCODE -ne 0) { throw 'Synthetic test cluster setup failed.' }
    }
    & node scripts/ai-devkit/verify.mjs
    if ($LASTEXITCODE -ne 0) { throw 'Offline DevKit validation failed.' }
    if ($Smoke) {
        & node scripts/ai-devkit/smoke-mcp.mjs
        if ($LASTEXITCODE -ne 0) { throw 'MCP smoke process failed; inspect the local report.' }
    }
    Write-Host 'DevKit installed. Global settings were preserved. Restart Codex to refresh skills and agents; authorize remote MCP separately.'
} finally { Pop-Location }
