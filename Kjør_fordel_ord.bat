@echo off
cd /d "%~dp0"
echo Starter fordel_ord_alfabetisk.py fra:
echo %CD%
echo.
"C:\Python314\python.exe" "%~dp0fordel_ord_alfabetisk.py"
echo.
echo Scriptet er avsluttet med kode %errorlevel%.
echo Terminalen holdes apen. Skriv exit for a lukke.
cmd /k
