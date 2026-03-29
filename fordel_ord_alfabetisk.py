# Dette skriptet henter alle ord fra kolonne AG i arket "Ordliste" i Ordliste_Norsk_ny.xlsx,
# sorterer dem alfabetisk, og skriver dem ut i kolonnene A:AC (én celle per ord, én rad per bokstav)
# slik at alle ord som starter med samme bokstav havner på samme rad.

from openpyxl import load_workbook
from openpyxl.utils import get_column_letter

EXCEL_FIL = "Ordliste_Norsk_ny.xlsx"
ARK = "Ordliste"
KILDEKOLONNE = "AG"
MALKOLONNER = 29  # A:AC

# 1. Les alle ord fra kolonne AG
def hent_ordliste(fil, ark, kolonne):
    wb = load_workbook(fil)
    ws = wb[ark]
    idx = ord(kolonne) - ord('A') + 1 if len(kolonne) == 1 else 33  # AG = 33
    ordliste = []
    for row in ws.iter_rows(min_col=idx, max_col=idx, min_row=1, values_only=True):
        verdi = row[0]
        if verdi and isinstance(verdi, str):
            ordliste.append(verdi.strip())
    return ordliste, wb, ws

# 2. Sorter ord alfabetisk
ordliste, wb, ws = hent_ordliste(EXCEL_FIL, ARK, KILDEKOLONNE)
ordliste = sorted(set(ordliste), key=lambda x: (x.lower(), x))

# 3. Fordel ordene på kolonnene A:AC etter første bokstav
#    (A: ord på A, B: ord på B, ... osv, AA: ord på Æ, AB: ord på Ø, AC: ord på Å)


# Norsk alfabet: A-Z, AA=Æ, AB=Ø, AC=Å
alfabet = [chr(i) for i in range(ord('A'), ord('Z')+1)] + ['Æ', 'Ø', 'Å']
kolonne_map = {bokstav: ("AA" if bokstav=="Æ" else "AB" if bokstav=="Ø" else "AC" if bokstav=="Å" else get_column_letter(ord(bokstav)-ord('A')+1)) for bokstav in alfabet}

# Samle ord per bokstav
ord_per_bokstav = {bokstav: [] for bokstav in alfabet}
for ordet in ordliste:
    if not ordet:
        continue
    for bokstav in alfabet:
        if ordet.upper().startswith(bokstav):
            ord_per_bokstav[bokstav].append(ordet)
            break

# 4. Skriv ut i kolonnene A:Z, AA=Æ, AB=Ø, AC=Å, én rad per ord
max_len = max(len(liste) for liste in ord_per_bokstav.values())

# Skriv ut i kolonnene A:Z, AA=Æ, AB=Ø, AC=Å, én rad per ord
for bokstav in alfabet:
    kol = kolonne_map[bokstav]
    sett = set()
    rad = 1
    for ordet in ord_per_bokstav[bokstav]:
        if ordet not in sett:
            ws[f"{kol}{rad}"] = ordet
            sett.add(ordet)
            rad += 1
        # Hvis duplikat, hopp over (ikke skriv inn)


# Slett alle verdier i kolonne AG
from openpyxl.utils import column_index_from_string
ag_idx = column_index_from_string("AG")
for row in ws.iter_rows(min_col=ag_idx, max_col=ag_idx, min_row=1):
    cell = row[0]
    cell.value = None


# Logg dato og antall nye ord i ark 'data'
from datetime import datetime
data_arknavn = "data"
if data_arknavn not in wb.sheetnames:
    wb.create_sheet(data_arknavn)
ws_data = wb[data_arknavn]
# Finn første ledige rad
rad = 1
while ws_data.cell(row=rad, column=1).value:
    rad += 1
ws_data.cell(row=rad, column=1, value=datetime.now().strftime("%Y-%m-%d %H:%M:%S"))
ws_data.cell(row=rad, column=2, value=len(ordliste))

wb.save(EXCEL_FIL)
print(f"Ferdig! Ordene er fordelt alfabetisk i kolonnene A:AC og kolonne AG er tømt i {EXCEL_FIL} (ark: {ARK}). Logg oppdatert i ark 'data'.")
