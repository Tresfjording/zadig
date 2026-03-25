@echo off
cd /d "%~dp0"

if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" "ordliste_edge_server.py"
) else (
    py "ordliste_edge_server.py"
)

pause