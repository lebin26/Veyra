<#
.SYNOPSIS
    db-replace.ps1 - Explicitly and destructively replaces Cloudflare D1 with local SQLite
    SAFEGUARDS:
      1. Mandatory production snapshot backup
      2. Clear warning display
      3. Strict text confirmation: Requires typing "YES_REPLACE_PRODUCTION"
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LocalSqlitePath = Join-Path $ProjectRoot "database\local.sqlite"
$LegacyDbPath = Join-Path $ProjectRoot "veyra.db"
$TmpDir = Join-Path $ProjectRoot "database\.tmp"
$ReplaceSqlPath = Join-Path $TmpDir "replace_prod.sql"

if (-not (Test-Path $LocalSqlitePath) -and (Test-Path $LegacyDbPath)) {
    $LocalSqlitePath = $LegacyDbPath
}

# Resolve Python / SQLite engine
$pythonExe = "python"
$candidatePy = "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
if (Test-Path $candidatePy) { $pythonExe = $candidatePy }

# Extract database details dynamically from wrangler.toml
$wranglerTomlPath = Join-Path $ProjectRoot "wrangler.toml"
$dbName = "veyra"
$dbId = "0f431065-816e-41e4-b428-43d59ac1a090"

if (Test-Path $wranglerTomlPath) {
    $tomlContent = Get-Content $wranglerTomlPath -Raw
    if ($tomlContent -match 'database_name\s*=\s*"([^"]+)"') { $dbName = $matches[1] }
    if ($tomlContent -match 'database_id\s*=\s*"([^"]+)"') { $dbId = $matches[1] }
}

if (-not (Test-Path $TmpDir)) {
    New-Item -ItemType Directory -Force -Path $TmpDir | Out-Null
}

Write-Host "`n========================================================" -ForegroundColor Red
Write-Host "     CRITICAL WARNING: REPLACE PRODUCTION DATABASE      " -ForegroundColor Red
Write-Host "========================================================" -ForegroundColor Red
Write-Host "This operation will REPLACE production Cloudflare D1 data" -ForegroundColor Yellow
Write-Host "with the current local SQLite database." -ForegroundColor Yellow
Write-Host "Target: $dbName ($dbId)" -ForegroundColor Yellow
Write-Host "--------------------------------------------------------" -ForegroundColor Gray

# Step 1: Backup production first
Write-Host "`n[1/4] Taking mandatory safety snapshot of Cloudflare Remote D1..." -ForegroundColor Yellow
& (Join-Path $PSScriptRoot "db-backup.ps1") -RemoteOnly

# Step 2: Strict Confirmation
Write-Host "`n[2/4] Strict Confirmation Required" -ForegroundColor Red
Write-Host "  Target: Cloudflare D1 '$dbName' ($dbId)"
Write-Host "  Source: $LocalSqlitePath"
$inputConfirm = Read-Host "Type 'YES_REPLACE_PRODUCTION' to proceed"

if ($inputConfirm -ne "YES_REPLACE_PRODUCTION") {
    Write-Host "`n[ABORTED] Confirmation failed. Remote database was NOT touched.`n" -ForegroundColor Green
    exit 0
}

# Step 3: Generate replacement SQL
Write-Host "`n[3/4] Exporting full local SQLite state to database\.tmp\..." -ForegroundColor Yellow
$dumpScript = Join-Path $PSScriptRoot "dump_sqlite.py"
$dumpRes = & $pythonExe $dumpScript $LocalSqlitePath $ReplaceSqlPath --replace-mode
if ($dumpRes -notlike "*SUCCESS*") {
    Write-Host "  [ERROR] Failed to dump local database: $dumpRes" -ForegroundColor Red
    exit 1
}

# Step 4: Execute on Remote
Write-Host "`n[4/4] Executing replacement on Cloudflare Remote D1 ($dbName)..." -ForegroundColor Yellow

$wranglerCmd = "wrangler"
$candidateWrangler = "$env:APPDATA\npm\wrangler.cmd"
if (Test-Path $candidateWrangler) { $wranglerCmd = $candidateWrangler }

$prevPref = $ErrorActionPreference
$ErrorActionPreference = "Continue"

try {
    $execRes = & $wranglerCmd d1 execute $dbName --remote --file="$ReplaceSqlPath" 2>&1
    if ($execRes -match "Error" -and $execRes -notmatch "allow-scripts") {
        Write-Host "`n[ERROR] Production replacement failed!" -ForegroundColor Red
        Write-Host $execRes
        exit 1
    }
} finally {
    $ErrorActionPreference = $prevPref
}

if (Test-Path $ReplaceSqlPath) { Remove-Item $ReplaceSqlPath -Force }

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "  SUCCESS: Cloudflare Production D1 completely replaced!" -ForegroundColor Green
Write-Host "========================================================`n" -ForegroundColor Green
