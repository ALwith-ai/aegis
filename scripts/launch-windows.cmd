@echo off
setlocal
"%~dp0aegis.exe" --output "%LOCALAPPDATA%\Aegis\Reports" %*
set "aegisExitCode=%ERRORLEVEL%"
if not "%aegisExitCode%"=="0" pause
exit /b %aegisExitCode%
