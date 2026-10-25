@echo off
cd /d "%~dp0"
if exist "%~dp0.venv\Scripts\python.exe" (
    "%~dp0.venv\Scripts\python.exe" "%~dp0fordel_ord_alfabetisk.py"
) else (
    "C:\Python314\python.exe" "%~dp0fordel_ord_alfabetisk.py"
)
if errorlevel 1 pause
