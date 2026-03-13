@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM ================================
REM   Oppsett
REM ================================
set "SCRIPT_DIR=%~dp0"
set "PY_SCRIPT=%SCRIPT_DIR%pdf_til_ordliste.py"
set "REQ=%SCRIPT_DIR%requirements.txt"

echo.
echo ============================================
echo   PDF  ->  ORDLISTE  (TXT + XLSX)  [Norsk]
echo ============================================
echo.

REM Finn Python (py -3 foretrukket paa Windows, ellers python i PATH)
set "PYEXE="
where py >nul 2>&1 && set "PYEXE=py -3"
if not defined PYEXE (
    where python >nul 2>&1 && set "PYEXE=python"
)
if not defined PYEXE (
    echo FEIL: Python ble ikke funnet i PATH.
    echo Installer fra https://www.python.org/ (huk av "Add Python to PATH") og prov igjen.
    pause
    exit /b 1
)

REM Installer avhengigheter
if exist "%REQ%" (
    echo Installerer/oppdaterer pip og krav fra requirements.txt ...
    "%PYEXE%" -m pip install --upgrade pip
    "%PYEXE%" -m pip install -r "%REQ%"
    echo.
) else (
    echo ADVARSEL: Fant ikke requirements.txt i %SCRIPT_DIR%
)

REM Ingen PDF gitt?
if "%~1"=="" (
    echo Dra og slipp PDF-filer rett paa denne .BAT-filen,
    echo eller kjør: "%~nx0" "C:\sti\til\fil.pdf"
    echo.
    pause
    exit /b 0
)

REM Kjor for hver oppgitt fil
for %%F in (%*) do (
    if /I not "%%~xF"==".pdf" (
        echo Hopper over: %%F  (ikke PDF)
        echo.
        goto :nextfile
    )

    echo Behandler: %%F

    REM Bytt til mappen der PDF-en ligger (sikrer lagring ved siden av PDF)
    pushd "%%~dpF"

    REM Kjor Python-skriptet
    "%PYEXE%" "%PY_SCRIPT%" "%%F" --skriv-txt --skriv-xlsx --stop-ord --min-lengde 2

    REM Forventede utfil-navn
    set "TXT=%%~dpnF_ordliste.txt"
    set "XLSX=%%~dpnF_ordliste.xlsx"

    if exist "!TXT!" (
        echo Apner TXT: !TXT!
        start "" notepad.exe "!TXT!"
    ) else (
        echo (INFO) Fant ikke TXT (!TXT!). Kanskje ingen ord?
    )

    if exist "!XLSX!" (
        echo Apner XLSX: !XLSX!
        start "" "!XLSX!"
    ) else (
        echo (INFO) Fant ikke XLSX (!XLSX!). Kanskje ingen ord?
    )

    popd

    echo Ferdig: %%~dpnF_ordliste.txt  /  %%~dpnF_ordliste.xlsx
    echo.

    :nextfile
)

echo Alt ferdig.
pause
