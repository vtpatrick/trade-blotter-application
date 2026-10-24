<#
.SYNOPSIS
    Runs the Trade Blotter API (.NET 8) in development mode.

.DESCRIPTION
    Starts the API on http://localhost:5035 (the "http" launch profile) with
    hot reload via `dotnet watch`. Swagger UI is at http://localhost:5035/swagger
    and the heartbeat at http://localhost:5035/api/health. NuGet packages are
    restored automatically by dotnet run / dotnet watch, and the SQLite database
    is created or migrated on startup.

.PARAMETER NoWatch
    Run without hot reload (plain `dotnet run`).

.EXAMPLE
    .\run_api.ps1
.EXAMPLE
    .\run_api.ps1 -NoWatch
#>
[CmdletBinding()]
param(
    [switch]$NoWatch
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command dotnet -ErrorAction SilentlyContinue)) {
    throw 'The .NET SDK was not found on PATH. Install the .NET 8 SDK: https://dotnet.microsoft.com/download/dotnet/8.0'
}

$installedSdks = @(dotnet --list-sdks)
if (-not ($installedSdks -match '^8\.0\.')) {
    $found = if ($installedSdks) { ($installedSdks | ForEach-Object { ($_ -split ' ')[0] }) -join ', ' } else { 'none' }
    throw "The .NET 8 SDK is required (installed SDKs: $found). Install it from https://dotnet.microsoft.com/download/dotnet/8.0"
}

$apiDir  = Join-Path $PSScriptRoot 'api'
$project = 'src/TradeBlotter.Api/TradeBlotter.Api.csproj'

# Run from api/ so api/global.json pins the .NET 8 SDK.
Push-Location $apiDir
try {
    $env:ASPNETCORE_ENVIRONMENT = 'Development'
    if ($NoWatch) {
        dotnet run --project $project --launch-profile http
    }
    else {
        dotnet watch run --project $project --launch-profile http
    }
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
