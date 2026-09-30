@echo off
title Veyra - Push Local Database to Cloudflare D1
echo ===================================================
echo   Veyra D1 Database Sync - Push to Remote Cloud
echo ===================================================

set "PATH=C:\Program Files\nodejs;%APPDATA%\npm;C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python312;%PATH%"

if not exist "%~dp0d1\local_data.sql" (
    echo [!] d1\local_data.sql does not exist yet.
    echo Please run: python scripts/db_manage.py add-user ^<username^> ^<password^>
    echo or create d1\local_data.sql with your SQL statements.
    pause
    exit /b 1
)

echo [1/2] Applying schema structure to Cloudflare D1 (veyra-db)...
call "%APPDATA%\npm\wrangler.cmd" d1 execute veyra-db --remote --file="%~dp0d1\schema.sql"
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Failed to execute schema.
    echo If you have not logged in yet, run: wrangler login
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/2] Overwriting/Inserting local data into Cloudflare D1 (veyra-db)...
call "%APPDATA%\npm\wrangler.cmd" d1 execute veyra-db --remote --file="%~dp0d1\local_data.sql"
if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] Failed to push local data.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo [SUCCESS] Local database successfully pushed to Cloudflare D1!
echo You can now log in at your live website.
echo ===================================================
pause
