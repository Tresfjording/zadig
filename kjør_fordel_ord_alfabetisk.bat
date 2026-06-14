@echo off
cd /d "%~dp0"
"%~dp0.venv\Scripts\python.exe" "%~dp0fordel_ord_alfabetisk.py"
if errorlevel 1 pause
