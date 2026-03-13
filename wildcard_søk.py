import pandas as pd
import fnmatch
import re

# ==============================
#  KONFIG
# ==============================
ORDFIL = "stor_ordliste.xlsx"   # ← bruk ditt faktiske filnavn
KOL = 0
MAKS_TREFF = 500

print("Leser ordliste...")
df = pd.read_excel(ORDFIL, header=None, engine="openpyxl")
ordliste = (
    df.iloc[:, KOL]
    .astype(str)
    .str.upper()
    .str.strip()
    .tolist()
)
print(f"Ordliste lastet: {len(ordliste):,} ord\n")


# ==============================
#  Robuste wildcard-søk
# ==============================
def wildcard_sok(mønster: str, maks=MAKS_TREFF):

    # Echo av hva brukeren faktisk skrev:
    print(f"\nDu skrev inn mønster: «{mønster}»")

    # Rens input FULLSTENDIG
    mønster = str(mønster).strip().upper()

    # Fjern CR/LF/whitespace
    mønster = mønster.replace("\r", "").replace("\n", "")

    # Underscore → fnmatch "?"
    mønster_fn = mønster.replace("_", "?")

    print(f"Søker etter mønster (renset): {mønster}")

    # Utfør søket
    treff = [w for w in ordliste if fnmatch.fnmatch(w, mønster_fn)]

    print(f"Antall treff: {len(treff):,}\n")
    if maks and len(treff) > maks:
        print(f"Viser de første {maks}:")
        return treff[:maks]
    return treff


# ==============================
#        INTERAKTIV MODUS
# ==============================
if __name__ == "__main__":
    print("Wildcard-søkemotor klar!\n")
    print("Eksempler:")
    print("  A_E__   (5 bokstaver)")
    print("  S*ING   (starter på S, slutter på ING)")
    print("  ??Ø??   (5 bokstaver med Ø i midten)")
    print("  FISKE__ (FISKE + 2 ekstra bokstaver)\n")

    while True:
        spm = input("Mønster (tom = avslutt): ")
        if not spm:
            break

        resultater = wildcard_sok(spm)
        for r in resultater:
            print(r)
        print("-----")