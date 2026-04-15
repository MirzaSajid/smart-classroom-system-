@echo off
setlocal

REM Always run from this folder (so images/ and cache paths work)
cd /d "%~dp0"

REM Prefer the Python launcher if available
where py >nul 2>nul
if %errorlevel%==0 (
  py -3.11 program.py
) else (
  python program.py
)

pause

