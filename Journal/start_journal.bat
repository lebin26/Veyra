@echo off
title VEYRA - Private Trading Journal
echo ===================================================
echo Starting VEYRA Local Server...
echo ===================================================

start powershell -ExecutionPolicy Bypass -NoExit -File "%~dp0server.ps1"
timeout /t 1 >nul
start http://localhost:8080/Journal/index.html
