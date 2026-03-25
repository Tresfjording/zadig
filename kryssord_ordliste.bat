@echo off
setlocal enabledelayedexpansion

REM ================================
REM   Oppsett
REM ================================

REM Finn mappen der BAT-filen ligger
set SCRIPT_DIR=%~dp0

REM Python-scriptet (samme mappe)
set PY_SCRIPT=%SCRIPT_DIR%pdf_til_ordliste.py

REM requirements
set REQ=%SCRIPT_DIR%requirements.txt

echo.
echo ================================
echo  PDF -> ORDLISTE (Kryssord)
echo ================================
echo.

REM Sjekk om Python finnes
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo FEIL: Python er ikke installert eller ikke i PATH.
    echo Installer Python fra https://www.python.org/ og prøv igjen.
    pause
    exit /b
)

echo Installerer nødvendige Python-pakker...
python -m pip install --upgrade pip
python -m pip install -r "%REQ%"
echo Ferdig!
echo.

REM ================================
REM   Ingen PDF gitt?
REM ================================
if "%~1"=="" (
    echo Dra og slipp én eller flere PDF-filer på denne .BAT-filen.
    pause
    exit /b
)

REM ================================
REM   Kjør scriptet for hver PDF
REM ================================
for %%F in (%*) do (
    echo Behandler: %%F
    python "%PY_SCRIPT%" "%%F" --ut "%%~dpnF_ordliste.xlsx"
    echo Resultat lagret som: %%~dpnF_ordliste.xlsx
    echo.
)

echo Alt ferdig!
pause