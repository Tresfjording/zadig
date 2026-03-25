import pandas as pd
from pathlib import Path

# ---- FILINNSTILLINGER ----
INNFIL = r"stor_ordliste.xlsx"      # <-- Bytt til navnet på din fil
UT_UNIQUE = "ordliste_unik.xlsx"
UT_DUPES = "ordliste_duplikater.xlsx"
UT_UNIQUE_TXT = "ordliste_unik.txt"

print("Leser Excel ...")
df = pd.read_excel(INNFIL, header=None, engine="openpyxl")

# Anta at ordet står i første kolonne
df = df.iloc[:, [0]].copy()
df.columns = ["ord"]

# Normaliser ord (uppercase + trimming)
df["ord"] = df["ord"].astype(str).str.strip().str.upper()

print("Finner duplikater ...")
dupes = df[df.duplicated("ord", keep=False)]
unique = df.drop_duplicates("ord")

print("Antall totalt:", len(df))
print("Antall unike:", len(unique))
print("Antall duplikate rader:", len(df) - len(unique))

# Skriver unike ord
print("Skriver unike →", UT_UNIQUE)
unique.to_excel(UT_UNIQUE, index=False)

# Skriver duplikater
print("Skriver duplikater →", UT_DUPES)
dupes.to_excel(UT_DUPES, index=False)

# Skriver TXT for lett søk
print("Skriver TXT (unik) →", UT_UNIQUE_TXT)
with open(UT_UNIQUE_TXT, "w", encoding="utf-8") as f:
    for w in unique["ord"]:
        f.write(str(w) + "\n")

print("\nFerdig!")