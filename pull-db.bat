@echo off
title Veyra - Export Remote Cloudflare D1 to Local
echo ===================================================
echo   Veyra D1 Database Sync - Export Remote Cloud to Local
echo ===================================================

set "PATH=C:\Program Files\nodejs;%APPDATA%\npm;%PATH%"

echo Exporting Cloudflare D1 (veyra-db) to d1\backup.sql...
call "%APPDATA%\npm\wrangler.cmd" d1 export veyra-db --remote --output="%~dp0d1\backup.sql"

if %ERRORLEVEL% equ 0 (
    echo.
    echo [SUCCESS] Backup saved to d1\backup.sql!
) else (
    echo.
    echo [ERROR] Export failed. Make sure you are logged in (wrangler login).
)
pause
