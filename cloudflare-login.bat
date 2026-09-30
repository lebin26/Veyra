@echo off
title Cloudflare Wrangler Login
echo ===================================================
echo   Logging in to Cloudflare for Wrangler...
echo ===================================================

set "WRANGLER_CMD=%APPDATA%\npm\wrangler.cmd"

call "%WRANGLER_CMD%" login

echo.
pause
