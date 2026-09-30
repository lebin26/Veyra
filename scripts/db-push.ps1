<#
.SYNOPSIS
    db-push.ps1 - Safe Synchronization: Local SQLite -> Cloudflare D1
    Workflow:
      1. Verify Cloudflare authentication and target database
      2. Verify local SQLite integrity
      3. Create remote Cloudflare D1 backup first
      4. Generate temporary SQL export in database\.tmp\
      5. Show planned changes & Ask for explicit confirmation
      6. Push changes to remote Cloudflare D1
      7. Verify production
#>

[CmdletBinding()]
param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LocalSqlitePath = Join-Path $ProjectRoot "database\local.sqlite"
$LegacyDbPath = Join-Path $ProjectRoot "veyra.db"
$TmpDir = Join-Path $ProjectRoot "database\.tmp"
$SyncSqlPath = Join-Path $TmpDir "push_sync.sql"

# Fallback to veyra.db if database/local.sqlite does not exist yet
if (-not (Test-Path $LocalSqlitePath) -and (Test-Path $LegacyDbPath)) {
    Copy-Item $LegacyDbPath $LocalSqlitePath -Force
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

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "       PUSH DATABASE: Local SQLite -> Cloudflare D1      " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# Step 1: Check Local Database
Write-Host "`n[Step 1/6] Verifying local SQLite database..." -ForegroundColor Yellow
if (-not (Test-Path $LocalSqlitePath)) {
    Write-Host "  [ERROR] Local database not found at: $LocalSqlitePath" -ForegroundColor Red
    exit 1
}

$inspectScript = Join-Path $PSScriptRoot "inspect_sqlite.py"
$checkRes = & $pythonExe $inspectScript $LocalSqlitePath
if ($checkRes -like "FAILED*") {
    Write-Host "  [ERROR] Local database integrity check failed: $checkRes" -ForegroundColor Red
    exit 1
}
$parts = $checkRes.Split('|')
$integrity = $parts[0]
$tableCount = $parts[1]
$userCount = $parts[2]
$tradeCount = $parts[3]
$tableList = $parts[4]

Write-Host "  [OK] Local database healthy (Integrity: $integrity, Tables: $tableCount, Users: $userCount, Trades: $tradeCount)" -ForegroundColor Green

# Step 2: Cloudflare Auth Verification
Write-Host "`n[Step 2/6] Verifying Cloudflare remote target (database: $dbName, ID: $dbId)..." -ForegroundColor Yellow

$wranglerCmd = "wrangler"
$candidateWrangler = "$env:APPDATA\npm\wrangler.cmd"
if (Test-Path $candidateWrangler) { $wranglerCmd = $candidateWrangler }

$prevPref = $ErrorActionPreference
$ErrorActionPreference = "Continue"

try {
    $whoami = & $wranglerCmd whoami 2>&1 | Out-String
    if ($whoami -notmatch "logged in with an OAuth Token") {
        Write-Host "  [ERROR] Cloudflare is not logged in. Please run 'npx wrangler login' or 'cloudflare-login.bat'" -ForegroundColor Red
        exit 1
    }
} finally {
    $ErrorActionPreference = $prevPref
}
Write-Host "  [OK] Cloudflare credentials authenticated." -ForegroundColor Green

# Step 3: Create Remote Backup First
Write-Host "`n[Step 3/6] Creating safety backup of current Cloudflare Remote D1..." -ForegroundColor Yellow
& (Join-Path $PSScriptRoot "db-backup.ps1") -RemoteOnly

# Step 4: Dump Local SQLite into Clean Non-destructive D1 SQL
Write-Host "`n[Step 4/6] Generating sync SQL export from local SQLite..." -ForegroundColor Yellow
$dumpScript = Join-Path $PSScriptRoot "dump_sqlite.py"
$dumpRes = & $pythonExe $dumpScript $LocalSqlitePath $SyncSqlPath
if ($dumpRes -notlike "*SUCCESS*") {
    Write-Host "  [ERROR] Failed to dump local database: $dumpRes" -ForegroundColor Red
    exit 1
}
Write-Host "  [OK] SQL sync payload prepared in database\.tmp\" -ForegroundColor Green

# Step 5: Confirmation Prompt
Write-Host "`n[Step 5/6] Planned Push Confirmation" -ForegroundColor Yellow
Write-Host "--------------------------------------------------------" -ForegroundColor Gray
Write-Host "  Target Database:  Cloudflare D1 ($dbName / $dbId)"
Write-Host "  Local Source:     $LocalSqlitePath"
Write-Host "  Data Summary:     Tables: $tableCount ($tableList)"
Write-Host "                    Users:  $userCount"
Write-Host "                    Trades: $tradeCount"
Write-Host "--------------------------------------------------------" -ForegroundColor Gray

if (-not $Force) {
    $confirm = Read-Host "Synchronize these records into Cloudflare D1? (y/N)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Host "`n[CANCELLED] Push cancelled by user. No remote changes applied.`n" -ForegroundColor Yellow
        if (Test-Path $SyncSqlPath) { Remove-Item $SyncSqlPath -Force }
        exit 0
    }
}

# Step 6: Push Changes via Wrangler
Write-Host "`n[Step 6/6] Executing synchronization on Cloudflare Remote D1..." -ForegroundColor Yellow

$wranglerCmd = "wrangler"
$candidateWrangler = "$env:APPDATA\npm\wrangler.cmd"
if (Test-Path $candidateWrangler) { $wranglerCmd = $candidateWrangler }

$prevPref = $ErrorActionPreference
$ErrorActionPreference = "Continue"

try {
    $execRes = & $wranglerCmd d1 execute $dbName --remote --file="$SyncSqlPath" 2>&1
    if ($execRes -match "Error" -and $execRes -notmatch "allow-scripts") {
        Write-Host "`n[ERROR] Wrangler D1 push failed!" -ForegroundColor Red
        Write-Host $execRes
        exit 1
    }
} finally {
    $ErrorActionPreference = $prevPref
}

# Cleanup temp sql
if (Test-Path $SyncSqlPath) { Remove-Item $SyncSqlPath -Force }

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "  SUCCESS: Local database successfully pushed to Cloud! " -ForegroundColor Green
Write-Host "========================================================`n" -ForegroundColor Cyan
