@echo off
title Sri Vasavi Temple - Receipt Management System
color 1F

echo =========================================================================
echo    SRI VASAVI KANYAKA PARAMESWARI AMMAVARI THADIYARADHANA SANGHAM
echo                 TEMPLE RECEIPT MANAGEMENT SYSTEM
echo =========================================================================
echo.
echo Starting Local Backend Server on http://localhost:5000 ...
echo.

cd /d "%~dp0"

:: Start PowerShell backend server in a separate process
start "Vasavi Temple Backend Server" /min powershell.exe -ExecutionPolicy Bypass -NoProfile -File "%~dp0server.ps1"

:: Wait 2 seconds for server to initialize
timeout /t 2 /nobreak > nul

:: Open browser automatically
echo Opening Website in your default browser...
start http://localhost:5000/

echo.
echo Server is running successfully!
echo You can use the website in your browser.
echo Do not close this window if you want to keep the server running.
echo To stop, simply close this window.
echo =========================================================================
pause
