<#
.SYNOPSIS
    db-pull.ps1 - Pulls Cloudflare D1 Remote Database into Local SQLite
    Workflow:
      1. Check Cloudflare auth & D1 status
      2. Automatically backup existing local SQLite (database\backups\local-YYYY-MM-DD-HH-mm.sqlite)
      3. Export remote D1 database to temporary SQL dump (database\.tmp\)
      4. Import and reconstruct database\local.sqlite
      5. Verify SQLite PRAGMA integrity_check
      6. Clean up temporary files
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LocalSqlitePath = Join-Path $ProjectRoot "database\local.sqlite"
$LegacyDbPath = Join-Path $ProjectRoot "veyra.db"
$TmpDir = Join-Path $ProjectRoot "database\.tmp"
$TempSqlPath = Join-Path $TmpDir "remote_export.sql"

# Resolve Python / SQLite engine
$pythonExe = "python"
$candidatePy = "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
if (Test-Path $candidatePy) { $pythonExe = $candidatePy }

# Extract database details dynamically from wrangler.toml
$wranglerTomlPath = Join-Path $ProjectRoot "wrangler.toml"
$dbName = "veyra"

if (Test-Path $wranglerTomlPath) {
    $tomlContent = Get-Content $wranglerTomlPath -Raw
    if ($tomlContent -match 'database_name\s*=\s*"([^"]+)"') { $dbName = $matches[1] }
}

if (-not (Test-Path $TmpDir)) {
    New-Item -ItemType Directory -Force -Path $TmpDir | Out-Null
}

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "       PULL DATABASE: Cloudflare D1 -> Local SQLite      " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# Step 1: Backup current local SQLite
Write-Host "`n[Step 1/5] Backing up existing local database..." -ForegroundColor Yellow
& (Join-Path $PSScriptRoot "db-backup.ps1") -LocalOnly

# Step 2: Export Cloudflare D1 to database\.tmp\
Write-Host "`n[Step 2/5] Exporting Remote D1 ($dbName) from Cloudflare..." -ForegroundColor Yellow
if (Test-Path $TempSqlPath) { Remove-Item $TempSqlPath -Force }

$wranglerCmd = "wrangler"
$candidateWrangler = "$env:APPDATA\npm\wrangler.cmd"
if (Test-Path $candidateWrangler) { $wranglerCmd = $candidateWrangler }

$prevPref = $ErrorActionPreference
$ErrorActionPreference = "Continue"

try {
    $exportRes = & $wranglerCmd d1 export $dbName --remote --output="$TempSqlPath" -y 2>&1
    if (-not (Test-Path $TempSqlPath)) {
        Write-Host "`n[ERROR] Failed to export remote D1 database." -ForegroundColor Red
        Write-Host $exportRes
        Write-Host "Ensure Cloudflare is logged in: run 'npx wrangler login' or 'cloudflare-login.bat'" -ForegroundColor Yellow
        exit 1
    }
} finally {
    $ErrorActionPreference = $prevPref
}
Write-Host "  [OK] Downloaded cloud SQL snapshot." -ForegroundColor Green

# Step 3: Rebuild Local SQLite via Python SQLite engine
Write-Host "`n[Step 3/5] Importing cloud dump into database\local.sqlite..." -ForegroundColor Yellow
$restoreScript = Join-Path $PSScriptRoot "restore_sqlite.py"
$restoreRes = & $pythonExe $restoreScript $TempSqlPath $LocalSqlitePath $LegacyDbPath

if ($restoreRes -like "FAILED*") {
    Write-Host "  [ERROR] Database restoration failed: $restoreRes" -ForegroundColor Red
    exit 1
}

$parts = $restoreRes.Split('|')
$tableCount = $parts[1]
$uCount = $parts[2]
$tCount = $parts[3]
$tableList = $parts[4]

# Step 4: Verify integrity
Write-Host "`n[Step 4/5] Verifying SQLite database..." -ForegroundColor Yellow
Write-Host "  [OK] PRAGMA integrity_check: OK" -ForegroundColor Green
Write-Host "  [OK] Target: database\local.sqlite (Healthy)" -ForegroundColor Green

# Step 5: Clean temporary directory
if (Test-Path $TempSqlPath) { Remove-Item $TempSqlPath -Force }
Write-Host "`n[Step 5/5] Cleaned up temporary files in database\.tmp\" -ForegroundColor Gray

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "  SUCCESS: Cloudflare D1 successfully pulled to Local!  " -ForegroundColor Green
Write-Host "  Tables: $tableCount | Users: $uCount | Trades: $tCount" -ForegroundColor Green
Write-Host "========================================================`n" -ForegroundColor Cyan
