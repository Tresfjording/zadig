@echo off
setlocal

cd /d "%~dp0"

set "PYTHON_EXE=%~dp0.venv\Scripts\python.exe"
set "SCRIPT=%~dp0importer_nye_ord_til_excel.py"
set "TXT_FILE=%~dp0ordliste_unik.txt"
set "EXCEL_FILE=%~dp0G-Ordliste.xlsm"

if not exist "%PYTHON_EXE%" (
    echo Fant ikke Python-miljoet: "%PYTHON_EXE%"
    pause
    exit /b 1
)

if not exist "%SCRIPT%" (
    echo Fant ikke skriptet: "%SCRIPT%"
    pause
    exit /b 1
)

if not exist "%TXT_FILE%" (
    echo Fant ikke tekstfilen: "%TXT_FILE%"
    pause
    exit /b 1
)

if not exist "%EXCEL_FILE%" (
    echo Fant ikke Excel-filen: "%EXCEL_FILE%"
    pause
    exit /b 1
)

echo Kjorer import av nye ord til Excel ...
echo.
"%PYTHON_EXE%" "%SCRIPT%" --txt "%TXT_FILE%" --excel "%EXCEL_FILE%"

echo.
pause