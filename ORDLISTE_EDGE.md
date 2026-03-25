# Ordliste i Edge

Dette verktøyet leser ord fra Excel-filen. Det prøver automatisk disse i rekkefølge:

- `C:\Users\ØyvindGranberg\OneDrive\Dokumenter\Annet\Ordlista HovedFil.xlsm`
- `C:\Users\ØyvindGranberg\OneDrive\Dokumenter\Annet\Ordliste Norsk.xlsm`

Du kan overstyre filen eksplisitt i PowerShell:

```powershell
$env:ORDLISTE_XLSM = "C:\\full\\sti\\til\\din\\fil.xlsm"
```

Det bruker disse arkene og områdene:

- `Ordliste!A:AC` som ordkilde
- `SearchWords!D3` som standard søkeord

## Hva det gjør

1. Leser alle ord i `Ordliste!A:AC`
2. Lager en lokal SQLite-indeks i `ordliste_cache.sqlite3`
3. Starter en lokal nettside på `http://127.0.0.1:8765`
4. Åpner siden i Edge hvis `msedge.exe` finnes på maskinen

## Installere

Kjør dette i prosjektmappen:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## Starte

```powershell
.\.venv\Scripts\python.exe .\ordliste_edge_server.py
```

Eller med batch-fil:

```powershell
.\start_ordliste.bat
```

Da kan du også starte ved å dobbeltklikke på `start_ordliste.bat` i prosjektmappen.

Ved oppstart skrives valgt Excel-fil ut i terminalen.

## Bruk

- Siden åpnes med søk fra `SearchWords!D3`
- Du kan også skrive inn et ord manuelt i nettleseren
- Wildcards støttes i søkefeltet:
	- `*` matcher null eller flere tegn
	- `?` matcher nøyaktig ett tegn
- Du kan justere `Maks treff i liste` i siden (standard 200)
- Sett `0` for å vise alle treff uten begrensning
- `Bygg indeks på nytt` tvinger fram ny indeksering hvis Excel-filen er endret

## Begrensning i første versjon

- Søket er eksakt søk
- Det betyr at `hus` matcher `hus`, men ikke `husdyr`