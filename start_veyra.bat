@echo off
title Veyra Trading Platform

echo ===================================================
echo Starting Veyra Trading Platform Server...
echo ===================================================

start "" powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File "%~dp0Journal\server.ps1"

timeout /t 1 >nul

start "" http://localhost:8080/index.html

exit