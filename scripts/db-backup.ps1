<#
.SYNOPSIS
    db-backup.ps1 - Creates safe timestamped backups of Local SQLite and Remote D1
#>

[CmdletBinding()]
param(
    [switch]$LocalOnly,
    [switch]$RemoteOnly
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BackupDir = Join-Path $ProjectRoot "database\backups"
$LocalSqlitePath = Join-Path $ProjectRoot "database\local.sqlite"
$LegacyDbPath = Join-Path $ProjectRoot "veyra.db"

if (-not (Test-Path $LocalSqlitePath) -and (Test-Path $LegacyDbPath)) {
    $LocalSqlitePath = $LegacyDbPath
}

if (-not (Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
}

$Timestamp = (Get-Date).ToString("yyyy-MM-dd-HH-mm")

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "                VEYRA DATABASE BACKUP ENGINE            " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Local Backup
if (-not $RemoteOnly) {
    Write-Host "`n[*] Backing up Local SQLite Database..." -ForegroundColor Yellow
    if (Test-Path $LocalSqlitePath) {
        $localDest = Join-Path $BackupDir "local-$Timestamp.sqlite"
        Copy-Item -Path $LocalSqlitePath -Destination $localDest -Force
        Write-Host "  [OK] Local backup created: database\backups\local-$Timestamp.sqlite" -ForegroundColor Green
    } else {
        Write-Host "  [WARN] Local SQLite database not found at: $LocalSqlitePath" -ForegroundColor DarkYellow
    }
}

# 2. Remote Backup
if (-not $LocalOnly) {
    Write-Host "`n[*] Exporting Cloudflare Remote D1 (veyra) Snapshot..." -ForegroundColor Yellow
    $remoteDest = Join-Path $BackupDir "remote-$Timestamp.sql"
    
    $wranglerCmd = "wrangler"
    $candidateWrangler = "$env:APPDATA\npm\wrangler.cmd"
    if (Test-Path $candidateWrangler) { $wranglerCmd = $candidateWrangler }

    $prevPref = $ErrorActionPreference
    $ErrorActionPreference = "Continue"

    try {
        $exportOutput = & $wranglerCmd d1 export veyra --remote --output="$remoteDest" -y 2>&1
        if (Test-Path $remoteDest) {
            $fileSize = (Get-Item $remoteDest).Length
            Write-Host "  [OK] Cloudflare D1 backup created: database\backups\remote-$Timestamp.sql ($fileSize bytes)" -ForegroundColor Green
        } else {
            Write-Host "  [WARN] Wrangler export completed without generating file." -ForegroundColor DarkYellow
        }
    } catch {
        Write-Host "  [ERROR] Failed to export remote D1 snapshot: $($_.Exception.Message)" -ForegroundColor Red
    } finally {
        $ErrorActionPreference = $prevPref
    }
}

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "  Backups safely preserved in: database\backups\" -ForegroundColor Green
Write-Host "========================================================`n" -ForegroundColor Cyan
