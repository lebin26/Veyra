<#
.SYNOPSIS
    db-status.ps1 - Veyra Database Health & Synchronization Inspector
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$LocalSqlitePath = Join-Path $ProjectRoot "database\local.sqlite"
$LegacyDbPath = Join-Path $ProjectRoot "veyra.db"

# Migrate or fallback to veyra.db if database/local.sqlite does not exist yet
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
$binding = "DB"

if (Test-Path $wranglerTomlPath) {
    $tomlContent = Get-Content $wranglerTomlPath -Raw
    if ($tomlContent -match 'database_name\s*=\s*"([^"]+)"') { $dbName = $matches[1] }
    if ($tomlContent -match 'database_id\s*=\s*"([^"]+)"') { $dbId = $matches[1] }
    if ($tomlContent -match 'binding\s*=\s*"([^"]+)"') { $binding = $matches[1] }
}

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "                VEYRA DATABASE STATUS                   " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. LOCAL SQLITE INSPECTION
Write-Host "`nLOCAL SQLite" -ForegroundColor Yellow
Write-Host "------------" -ForegroundColor Gray
Write-Host "  Path:             database\local.sqlite"

if (Test-Path $LocalSqlitePath) {
    $fileItem = Get-Item $LocalSqlitePath
    $sizeKb = [Math]::Round($fileItem.Length / 1KB, 2)
    Write-Host "  Exists:           YES" -ForegroundColor Green
    Write-Host "  Size:             $sizeKb KB"

    try {
        $inspectScript = Join-Path $PSScriptRoot "inspect_sqlite.py"
        $pyResult = & $pythonExe $inspectScript $LocalSqlitePath
        if ($pyResult -like "FAILED*") {
            Write-Host "  SQLite Integrity: FAILED ($pyResult)" -ForegroundColor Red
        } else {
            $parts = $pyResult.Split('|')
            $integrity = $parts[0]
            $tableCount = $parts[1]
            $userCount = $parts[2]
            $tradeCount = $parts[3]
            $tablesList = $parts[4]

            if ($integrity -eq "ok") {
                Write-Host "  SQLite Integrity: OK" -ForegroundColor Green
            } else {
                Write-Host "  SQLite Integrity: $integrity" -ForegroundColor Red
            }
            Write-Host "  Tables ($tableCount):      $tablesList" -ForegroundColor DarkGray
            Write-Host "  Rows:             users: $userCount | trades: $tradeCount"
        }
    } catch {
        Write-Host "  SQLite Integrity: UNKNOWN (Inspection failed: $($_.Exception.Message))" -ForegroundColor Yellow
    }
} else {
    Write-Host "  Exists:           NO" -ForegroundColor Red
    Write-Host "  Action Required:  Run 'npm run db:pull' or create via d1/schema.sql" -ForegroundColor Yellow
}

# 2. CLOUDFLARE D1 INSPECTION
Write-Host "`nCLOUDFLARE D1" -ForegroundColor Yellow
Write-Host "-------------" -ForegroundColor Gray
Write-Host "  Database Name:    $dbName"
Write-Host "  Database ID:      $dbId"
Write-Host "  Binding:          $binding"
Write-Host "  Environment:      production"

# Resolve wrangler command
$wranglerCmd = "wrangler"
$candidateWrangler = "$env:APPDATA\npm\wrangler.cmd"
if (Test-Path $candidateWrangler) { $wranglerCmd = $candidateWrangler }

$prevPref = $ErrorActionPreference
$ErrorActionPreference = "Continue"

try {
    # Check Wrangler Auth
    $whoami = & $wranglerCmd whoami 2>&1 | Out-String
    if ($whoami -match "logged in with an OAuth Token") {
        Write-Host "  Authentication:   OK (Authenticated)" -ForegroundColor Green
    } else {
        Write-Host "  Authentication:   FAILED (Run 'npx wrangler login' or 'cloudflare-login.bat')" -ForegroundColor Yellow
    }

    # Query Remote Tables safely by extracting JSON array
    $rawRemote = & $wranglerCmd d1 execute $dbName --remote --command="SELECT name FROM sqlite_master WHERE type='table';" --json 2>&1 | Out-String
    $jsonStartIndex = $rawRemote.IndexOf("[")
    $jsonEndIndex = $rawRemote.LastIndexOf("]")
    if ($jsonStartIndex -ge 0 -and $jsonEndIndex -gt $jsonStartIndex) {
        $jsonStr = $rawRemote.Substring($jsonStartIndex, ($jsonEndIndex - $jsonStartIndex + 1))
        $parsed = ConvertFrom-Json $jsonStr
        $remoteTables = @($parsed[0].results | ForEach-Object { $_.name })
        Write-Host "  Remote Tables:    $($remoteTables.Count) ($($remoteTables -join ', '))" -ForegroundColor Cyan

        if ($remoteTables -contains "users") {
            $rawUser = & $wranglerCmd d1 execute $dbName --remote --command="SELECT COUNT(*) as count FROM users;" --json 2>&1 | Out-String
            $uStart = $rawUser.IndexOf("[")
            $uEnd = $rawUser.LastIndexOf("]")
            if ($uStart -ge 0 -and $uEnd -gt $uStart) {
                $uJsonStr = $rawUser.Substring($uStart, ($uEnd - $uStart + 1))
                $userParsed = ConvertFrom-Json $uJsonStr
                $uCount = $userParsed[0].results[0].count
                Write-Host "  Remote Users:     $uCount" -ForegroundColor Green
            }
        }
    } else {
        Write-Host "  Remote Status:    Configured"
    }
} catch {
    Write-Host "  [WARN] Cloudflare remote query error: $($_.Exception.Message)" -ForegroundColor Red
} finally {
    $ErrorActionPreference = $prevPref
}

Write-Host "`n========================================================`n" -ForegroundColor Cyan
