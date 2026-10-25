import pandas as pd

# ---- FILINNSTILLINGER ----
INNFIL = r"ordliste_norsk_ny.xlsx"
UTFIL = r"ordliste_norsk_ny_sortert.xlsx"


def kolonnenavn(index: int) -> str:
    """Returnerer Excel-kolonnenavn for 1-basert index, f.eks. 1 -> A, 29 -> AC."""
    result = ""
    while index > 0:
        index, remainder = divmod(index - 1, 26)
        result = chr(65 + remainder) + result
    return result


print("Leser Excel ...")
df = pd.read_excel(INNFIL, header=None, engine="openpyxl")

# Behold kun de første 29 kolonnene
workbook = df.iloc[:, :29].copy()

for col_index in range(workbook.shape[1]):
    col_name = kolonnenavn(col_index + 1)
    print(f"\n=== Sjekker kolonne {col_name} ===")

    series = workbook.iloc[:, col_index].dropna().astype(str).str.strip().str.upper()
    series = series[series != ""]

    print(f"Antall verdier i kolonnen: {len(series)}")

    unique = series.drop_duplicates().sort_values().reset_index(drop=True)
    dupes = series[series.duplicated(keep=False)].sort_values().reset_index(drop=True)

    print(f"Unike verdier i kolonnen: {len(unique)}")
    print(f"Duplikater i kolonnen: {len(dupes)}")

    # Skriv de unike verdiene tilbake i samme kolonne, i alfabetisk rekkefølge
    workbook.iloc[:len(unique), col_index] = unique.to_list()

    # Tøm resten av kolonnen etter de unike verdiene
    if len(unique) < workbook.shape[0]:
        workbook.iloc[len(unique):, col_index] = None

print(f"\nSkriver oppdatert fil -> {UTFIL}")
workbook.to_excel(UTFIL, index=False, header=False)
print("\nFerdig! Hver kolonne er oppdatert og sortert alfabetisk.")