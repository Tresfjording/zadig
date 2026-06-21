# Dette skriptet henter alle ord fra kolonne AG i arket "Ordliste" i Ordliste_Norsk_ny.xlsx,
# sorterer dem alfabetisk, og skriver dem ut i kolonnene A:AC (én celle per ord, én rad per bokstav)
# slik at alle ord som starter med samme bokstav havner på samme rad.

print("Starter scriptet...")

import os
import time
import shutil
from datetime import datetime
from pathlib import Path
from tempfile import NamedTemporaryFile

from openpyxl import load_workbook
from openpyxl.utils import column_index_from_string, get_column_letter

BASE_DIR = Path(__file__).resolve().parent
EXCEL_FIL = "Ordliste_Norsk_ny.xlsx"
EXCEL_PATH = BASE_DIR / EXCEL_FIL
ARK = "Ordliste"
KILDEKOLONNE = "AG"
MALKOLONNER = 29  # A:AC
RESTART_DELAY_SEKUNDER = 3
RESTART_VAKT_SEKUNDER = 10
RESTART_VAKT_FIL = BASE_DIR / ".fordel_ord_restart_guard"


def restart_vakt_aktiv():
    if not RESTART_VAKT_FIL.exists():
        return False

    try:
        forrige_start = float(RESTART_VAKT_FIL.read_text(encoding="utf-8").strip())
    except Exception:
        RESTART_VAKT_FIL.unlink(missing_ok=True)
        return False

    if time.time() - forrige_start <= RESTART_VAKT_SEKUNDER:
        print("Avslutter for å unngå restart-loop etter gjenåpning av Excel-filen.")
        RESTART_VAKT_FIL.unlink(missing_ok=True)
        return True

    RESTART_VAKT_FIL.unlink(missing_ok=True)
    return False


def sett_restart_vakt():
    RESTART_VAKT_FIL.write_text(str(time.time()), encoding="utf-8")


def lukk_excel_if_open():
    """Lukker Excel hvis den er åpen (bruker taskkill som fallback)."""
    print("Lukker Excel hvis den er åpen...")
    try:
        import subprocess
        
        # Sjekk først om Excel kjører
        check_result = subprocess.run(
            ["tasklist"],
            capture_output=True,
            text=True,
            timeout=5
        )
        
        if "excel.exe" not in check_result.stdout.lower():
            print("Excel var ikke kjørende.")
            return
        
        # Excel kjører, så lukk den
        result = subprocess.run(
            ["taskkill", "/IM", "excel.exe", "/F"],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            print("Excel avsluttet.")
            time.sleep(1)  # Gi systemet tid til å frigjøre filen
        else:
            print(f"Advarsel ved forsøk på å lukke Excel: {result.stderr}")
    except Exception as e:
        print(f"Kunne ikke lukke Excel via taskkill: {e}")
        print("Vennligst lukk Excel manuelt og kjør scriptets igjen.")


def apne_excel_fil_pa_nytt():
    sett_restart_vakt()
    print(f"Venter {RESTART_DELAY_SEKUNDER} sekunder før Excel-filen åpnes igjen...")
    time.sleep(RESTART_DELAY_SEKUNDER)
    os.startfile(EXCEL_PATH)
    print(f"Excel-filen er åpnet igjen: {EXCEL_PATH.name}")


def normaliser_ord(verdi):
    if verdi is None:
        return None
    tekst = str(verdi).strip()
    if tekst == "":
        return None
    return tekst.casefold()


def finn_siste_rad_med_innhold(ws, kolonne):
    """Finner siste rad med innhold i gitt kolonne."""
    col_idx = column_index_from_string(kolonne)
    siste_rad = 0
    
    for rad in range(1, ws.max_row + 1):
        verdi = ws.cell(row=rad, column=col_idx).value
        if verdi is not None and str(verdi).strip() != "":
            siste_rad = rad
    
    return siste_rad


def les_kolonneverdier(ws, kolonne, start_rad=1):
    """Leser alle verdier fra gitt kolonne."""
    col_idx = column_index_from_string(kolonne)
    verdier = []
    
    for rad in range(start_rad, ws.max_row + 1):
        verdi = ws.cell(row=rad, column=col_idx).value
        if verdi is not None:
            verdier.append(verdi)
    
    return verdier


def hent_eller_opprett_ark(arbeidsbok, arknavn):
    """Henter eksisterende ark eller oppretter nytt."""
    if arknavn in arbeidsbok.sheetnames:
        print(f"Bruker eksisterende ark: {arknavn}")
        return arbeidsbok[arknavn]
    else:
        print(f"Oppretter manglende ark: {arknavn}")
        return arbeidsbok.create_sheet(arknavn)


def hent_ordliste(ws, kolonne):
    """Henter alle ord fra gitt kolonne."""
    print(f"Leser ark: {ws.title}, kolonne: {kolonne}")
    ordliste = []
    
    for verdi in les_kolonneverdier(ws, kolonne):
        if verdi and isinstance(verdi, str):
            ordliste.append(verdi.strip())
    
    print(f"Antall ord hentet: {len(ordliste)}")
    return ordliste


def fordel_ord(ordliste, ws):
    """Fordeler ord alfabetisk i kolonnene A:AC."""
    print("Sorterer ord...")
    ordliste = sorted(set(ordliste), key=lambda x: (x.lower(), x))
    print(f"Antall unike ord: {len(ordliste)}")

    alfabet = [chr(i) for i in range(ord('A'), ord('Z') + 1)] + ['Æ', 'Ø', 'Å']
    kolonne_map = {
        bokstav: (
            "AA" if bokstav == "Æ"
            else "AB" if bokstav == "Ø"
            else "AC" if bokstav == "Å"
            else get_column_letter(ord(bokstav) - ord('A') + 1)
        )
        for bokstav in alfabet
    }

    # Fordel ord etter første bokstav
    ord_per_bokstav = {bokstav: [] for bokstav in alfabet}
    for ordet in ordliste:
        if not ordet:
            continue
        for bokstav in alfabet:
            if ordet.upper().startswith(bokstav):
                ord_per_bokstav[bokstav].append(ordet)
                break

    print("Skriver ut ord i kolonner...")
    
    # Samle eksisterende ord for å unngå duplikater
    eksisterende_ord = set()
    for col_idx in range(1, MALKOLONNER + 1):
        kol = get_column_letter(col_idx)
        for verdi in les_kolonneverdier(ws, kol):
            normalisert = normaliser_ord(verdi)
            if normalisert:
                eksisterende_ord.add(normalisert)

    antall_nye_ord = 0
    antall_duplikater_hoppet_over = 0
    
    # Skriv nye ord til hver kolonne
    for bokstav in alfabet:
        kol = kolonne_map[bokstav]
        col_idx = column_index_from_string(kol)
        sett = set()
        siste_rad_med_innhold = finn_siste_rad_med_innhold(ws, kol)

        # Samle eksisterende ord i denne kolonnen
        for verdi in les_kolonneverdier(ws, kol):
            normalisert = normaliser_ord(verdi)
            if not normalisert:
                continue
            sett.add(normalisert)

        rad = max(1, siste_rad_med_innhold + 1)
        for ordet in ord_per_bokstav[bokstav]:
            normalisert = normaliser_ord(ordet)
            if normalisert and normalisert not in eksisterende_ord and normalisert not in sett:
                ws.cell(row=rad, column=col_idx).value = ordet
                print(f"Legger inn ord '{ordet}' i kolonne {kol}, rad {rad}")
                sett.add(normalisert)
                eksisterende_ord.add(normalisert)
                antall_nye_ord += 1
                rad += 1
            elif normalisert:
                antall_duplikater_hoppet_over += 1

    print(f"Antall ord hentet fra AG: {len(ordliste)}")
    print(f"Antall nye ord lagt inn: {antall_nye_ord}")
    print(f"Antall duplikater hoppet over: {antall_duplikater_hoppet_over}")
    print("Fordeling av ord er fullført.")
    return antall_nye_ord, antall_duplikater_hoppet_over


def tom_kildekolonne(ws):
    """Tømmer kildekolonnen (AG)."""
    print("Tømmer kolonne AG...")
    col_idx = column_index_from_string(KILDEKOLONNE)
    
    for rad in range(1, ws.max_row + 1):
        ws.cell(row=rad, column=col_idx).value = None
    
    print(f"Kolonne {KILDEKOLONNE} tømt.")


def tell_ord_i_malkolonner(ws):
    """Teller alle ord i målkolonnene A:AC."""
    antall_ord = 0
    
    for col_idx in range(1, MALKOLONNER + 1):
        for rad in range(1, ws.max_row + 1):
            verdi = ws.cell(row=rad, column=col_idx).value
            if verdi is not None and str(verdi).strip() != "":
                antall_ord += 1
    return antall_ord


def logg_kjoring(wb, ws, antall_hentet, antall_nye_ord, antall_duplikater_hoppet_over):
    """Logger kjøringsstatistikk til eget ark."""
    data_arknavn = "data_logg"
    print(f"Logger til ark '{data_arknavn}'...")
    
    data_overskrifter = [
        "Tidspunkt",
        "Antall ord hentet fra AG",
        "Antall nye ord lagt inn",
        "Antall duplikater hoppet over",
        "Totalt antall ord i A:AC",
    ]
    
    ws_data = hent_eller_opprett_ark(wb, data_arknavn)
    
    # Skriv overskrifter hvis de ikke finnes
    if ws_data.cell(row=1, column=1).value is None:
        for kolonne, overskrift in enumerate(data_overskrifter, start=1):
            ws_data.cell(row=1, column=kolonne).value = overskrift

    # Finn siste rad med data
    siste_rad = finn_siste_rad_med_innhold(ws_data, "A")
    rad = max(2, siste_rad + 1)
    
    print(f"Skriver logg på rad {rad} i ark '{data_arknavn}'.")

    ws_data.cell(row=rad, column=1).value = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    ws_data.cell(row=rad, column=2).value = antall_hentet
    ws_data.cell(row=rad, column=3).value = antall_nye_ord
    ws_data.cell(row=rad, column=4).value = antall_duplikater_hoppet_over

    print("Teller alle ord i Ordliste!A:AC...")
    antall_ord = tell_ord_i_malkolonner(ws)
    ws_data.cell(row=rad, column=5).value = antall_ord
    print(f"Antall ord i Ordliste!A:AC: {antall_ord}")


def main():
    if restart_vakt_aktiv():
        return

    print("Starter behandling av Excel-filen...")
    
    if not EXCEL_PATH.exists():
        print(f"FEIL: Excel-filen ble ikke funnet: {EXCEL_PATH}")
        return

    wb = None

    try:
        print(f"Åpner fil for behandling: {EXCEL_FIL}")
        wb = load_workbook(EXCEL_PATH)
        
        if ARK not in wb.sheetnames:
            print(f"FEIL: Ark '{ARK}' ble ikke funnet i arbeidsboken.")
            return
        
        print(f"Henter arbeidsark: {ARK}")
        ws = wb[ARK]
        
        ordliste = hent_ordliste(ws, KILDEKOLONNE)
        antall_nye_ord, antall_duplikater_hoppet_over = fordel_ord(ordliste, ws)
        tom_kildekolonne(ws)
        logg_kjoring(
            wb,
            ws,
            antall_hentet=len(ordliste),
            antall_nye_ord=antall_nye_ord,
            antall_duplikater_hoppet_over=antall_duplikater_hoppet_over,
        )
        
        # Lukk Excel før vi prøver å lagre
        lukk_excel_if_open()
        
        print("Lagrer fil...")
        
        # Lagre til temp-fil først, så bytt
        temp_path = EXCEL_PATH.with_stem(EXCEL_PATH.stem + "_temp")
        
        for forsok in range(3):
            try:
                wb.save(str(temp_path))
                print(f"Lagret til temp-fil: {temp_path.name}")
                
                # Kopier temp-fil over original (slett original først)
                if EXCEL_PATH.exists():
                    EXCEL_PATH.unlink()
                shutil.move(str(temp_path), str(EXCEL_PATH))
                print("Lagring fullført.")
                break
                
            except PermissionError as pe:
                if forsok < 2:
                    print(f"Forsøk {forsok + 1} på lagring feilet (filen kan være låst av Excel). Venter 2 sekunder...")
                    time.sleep(2)
                    # Slett temp-fil hvis den ble opprettet
                    if temp_path.exists():
                        try:
                            temp_path.unlink()
                        except:
                            pass
                else:
                    print(f"FEIL: Kunne ikke lagre filen selv etter 3 forsøk.")
                    print("Løsning: Lukk Excel-filen og kjør scriptets igjen.")
                    # Slett temp-fil
                    if temp_path.exists():
                        try:
                            temp_path.unlink()
                        except:
                            pass
        
    except Exception as e:
        print(f"FEIL under behandling: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if wb is not None:
            try:
                wb.close()
            except Exception as e:
                print(f"Advarsel ved lukking av arbeidsbok: {e}")

    print(
        f"Ferdig! Ordene er fordelt alfabetisk i kolonnene A:AC og kolonne {KILDEKOLONNE} er tømt i {EXCEL_FIL}."
    )
    apne_excel_fil_pa_nytt()


if __name__ == "__main__":
    main()


if __name__ == "__main__":
    main()
