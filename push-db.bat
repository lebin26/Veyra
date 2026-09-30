@echo off
title Veyra - Push veyra.db to Cloudflare D1
echo ===================================================
echo   Veyra - Push Local veyra.db to Cloudflare Remote D1
echo ===================================================

set "PYTHON_EXE=C:\Users\%USERNAME%\AppData\Local\Programs\Python\Python312\python.exe"
set "WRANGLER_CMD=%APPDATA%\npm\wrangler.cmd"

if not exist "%~dp0veyra.db" (
    echo [ERROR] veyra.db not found!
    pause
    exit /b 1
)

echo [1/2] Converting veyra.db into Cloudflare SQL dump...
"%PYTHON_EXE%" "%~dp0scripts\dump_db.py"
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Failed to read veyra.db.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [2/2] Overwriting Cloudflare Remote D1 (veyra-db)...
call "%WRANGLER_CMD%" d1 execute veyra-db --remote --file="%~dp0d1\local_data.sql"

if %ERRORLEVEL% equ 0 (
    echo.
    echo ===================================================
    echo [SUCCESS] veyra.db successfully pushed to Cloudflare D1!
    echo ===================================================
) else (
    echo.
    echo [!] Push failed.
    echo If you are not logged in, double click 'cloudflare-login.bat' first!
)
pause
