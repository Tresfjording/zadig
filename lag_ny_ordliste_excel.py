from openpyxl import Workbook
import locale

TXT_FIL = "ordliste_fra_sqlite.txt"
NY_EXCEL = "Ordliste_Norsk_ny.xlsx"
ARK = "Ordliste"

# Norsk alfabet med Æ, Ø, Å
alfabet = [
    "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
    "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
    "Æ", "Ø", "Å"
]

# Norsk sortering
try:
    locale.setlocale(locale.LC_COLLATE, "nb_NO.UTF-8")
except locale.Error:
    locale.setlocale(locale.LC_COLLATE, "")

def norsk_sortering(ordliste):
    return sorted(ordliste, key=locale.strxfrm)

# Les og sorter alle ord
with open(TXT_FIL, encoding="utf-8") as f:
    ordliste = [linje.strip() for linje in f if linje.strip()]

ordliste = norsk_sortering(ordliste)

# Fordel ordene på kolonner etter første bokstav
kolonner = {bokstav: [] for bokstav in alfabet}
for ord in ordliste:
    første = ord[0].upper()
    if første in kolonner:
        kolonner[første].append(ord)
    else:
        # Ord med ukjent start havner i kolonne A
        kolonner["A"].append(ord)

# Lag nytt Excel-ark
wb = Workbook()
ws = wb.active
ws.title = ARK

# Skriv ut ord etter alfabetet i kolonner A:AC
for col_idx, bokstav in enumerate(alfabet, start=1):
    ord_liste = kolonner[bokstav]
    for rad_idx, ord in enumerate(ord_liste, start=1):
        ws.cell(row=rad_idx, column=col_idx, value=ord)

wb.save(NY_EXCEL)
print(f"Ferdig! {len(ordliste)} ord skrevet til {NY_EXCEL} [{ARK}!A:AC] etter alfabetet")