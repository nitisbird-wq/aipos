@echo off
REM AIPOS local starter — avoids PowerShell execution-policy issues with npm.ps1
cd /d "%~dp0"
echo Starting AIPOS Mission Intake MVP...
echo.
call npm.cmd run dev
pause
