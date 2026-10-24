<#
.SYNOPSIS
    Runs the Trade Blotter frontend (Vue 3 + Vite) in development mode.

.DESCRIPTION
    Starts the Vite dev server on http://localhost:5173. Requests to /api and
    /hubs are proxied to the API (see app/vite.config.ts), so start it with
    .\run_api.ps1.

    Dependencies are installed with `npm ci` (exact versions from
    package-lock.json) on first run and again whenever package-lock.json has
    changed since the last install, e.g. after a git pull.

.PARAMETER Install
    Force a clean reinstall of dependencies before starting.

.EXAMPLE
    .\run_app.ps1
.EXAMPLE
    .\run_app.ps1 -Install
#>
[CmdletBinding()]
param(
    [switch]$Install
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command node -ErrorAction SilentlyContinue) -or -not (Get-Command npm -ErrorAction SilentlyContinue)) {
    throw 'Node.js was not found on PATH. Install Node.js 24 LTS (or 22.18+): https://nodejs.org/'
}

# Mirrors "engines" in app/package.json: ^22.18.0 || >=24.12.0
$nodeVersion = [version](node --version).TrimStart('v')
$nodeSupported = ($nodeVersion.Major -eq 22 -and $nodeVersion.Minor -ge 18) -or ($nodeVersion -ge [version]'24.12.0')
if (-not $nodeSupported) {
    Write-Warning "Node.js $nodeVersion is not supported (need ^22.18.0 or >=24.12.0); the dev server may fail. Get Node.js 24 LTS from https://nodejs.org/"
}

$appDir = Join-Path $PSScriptRoot 'app'

Push-Location $appDir
try {
    # npm writes node_modules/.package-lock.json on every install, so a lockfile
    # newer than it means dependencies changed since the last install.
    $installMarker = 'node_modules/.package-lock.json'
    $needsInstall = $Install -or
        -not (Test-Path $installMarker) -or
        ((Get-Item 'package-lock.json').LastWriteTimeUtc -gt (Get-Item $installMarker).LastWriteTimeUtc)

    if ($needsInstall) {
        Write-Host 'Installing frontend dependencies (npm ci)...' -ForegroundColor Cyan
        npm ci
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }

    npm run dev
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
