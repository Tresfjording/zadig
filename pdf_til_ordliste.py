
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PDF → OrdListe (Norsk)
----------------------
Leser tekst fra én eller flere PDF-filer, renser og ekstraherer ord (inkl. ÆØÅ),
teller frekvens, og lagrer resultatet til Excel (.xlsx) og/eller CSV.

Avhengigheter:
    pip install pdfplumber pandas openpyxl

Bruk:
    python pdf_til_ordliste.py input1.pdf [input2.pdf ...] \
        --ut x.xlsx --min-lengde 2 --lag-csv

Tips:
    - Hvis PDF-en er scannet (bare bilder), trenger du OCR (se README i koden).
"""

import argparse
import re
import sys
from pathlib import Path

import pdfplumber
import pandas as pd

# ---------------------------
# Hjelpefunksjoner
# ---------------------------

def les_pdf_tekst(pdf_path: Path) -> str:
    """Returnerer all tekst fra en PDF ved hjelp av pdfplumber.
    Fungerer best på 'ekte' tekst-PDF-er (ikke rene skannede bilder).
    """
    tekst_biter = []
    with pdfplumber.open(str(pdf_path)) as pdf:
        for side in pdf.pages:
            t = side.extract_text() or ""
            # Noen ganger kan siden returnere None hvis det ikke finnes tekstlag.
            tekst_biter.append(t)
    return "\n".join(tekst_biter)

def normaliser_tekst(t: str) -> str:
    """Rens: fjern myke bindestreker, slå sammen orddeling over linjeskift,
    standardiser mellomrom."""
    if not t:
        return ""
    # Fjern 'soft hyphen'
    t = t.replace("\u00AD", "")
    # Fjern bindestrek ved linjeslutt med påfølgende linjeskift (orddeling)
    t = re.sub(r"-\s*\n", "", t)
    # Erstatt linjeskift med mellomrom
    t = t.replace("\r", "\n")
    t = re.sub(r"\n+", " ", t)
    # Komprimer flere mellomrom
    t = re.sub(r"\s+", " ", t).strip()
    return t

def ekstraher_ord(t: str, min_len: int = 2):
    """Returner liste over ord (kun bokstaver A-Z + ÆØÅ), i UPPERCASE.
    min_len: minste tillatte ordlengde.
    """
    if not t:
        return []
    t_upper = t.upper()
    # Finn sekvenser av bokstaver inkl. norske
    tokens = re.findall(r"[A-ZÆØÅ]+", t_upper)
    # Filtrer på lengde
    return [w for w in tokens if len(w) >= min_len]

def bygg_dataframe(ordliste):
    """Lag en DataFrame med unike ord, frekvens og lengde."""
    if not ordliste:
        return pd.DataFrame(columns=["Ord", "Frekvens", "Lengde"])  # tom
    s = pd.Series(ordliste, name="Ord")
    freq = s.value_counts().rename_axis("Ord").reset_index(name="Frekvens")
    freq["Lengde"] = freq["Ord"].str.len()
    return freq

# ---------------------------
# CLI
# ---------------------------

def main(argv=None):
    p = argparse.ArgumentParser(description="PDF → OrdListe (norsk)")
    p.add_argument("pdf", nargs="+", type=Path, help="Én eller flere PDF-filer")
    p.add_argument("--ut", "--output", dest="ut", type=Path, default=Path("ordliste.xlsx"),
                   help="Sti til utfil (Excel .xlsx)")
    p.add_argument("--min-lengde", dest="min_len", type=int, default=2,
                   help="Minste ordlengde som tas med (default: 2)")
    p.add_argument("--lag-csv", action="store_true", help="I tillegg lag CSV ved siden av .xlsx")
    args = p.parse_args(argv)

    alle_ord = []
    for pdf_path in args.pdf:
        if not pdf_path.exists():
            print(f"Advarsel: Finner ikke {pdf_path}", file=sys.stderr)
            continue
        print(f"Leser: {pdf_path}")
        t = les_pdf_tekst(pdf_path)
        t = normaliser_tekst(t)
        ord_liste = ekstraher_ord(t, min_len=args.min_len)
        print(f"  → {len(ord_liste)} ord funnet før deduplisering")
        alle_ord.extend(ord_liste)

    df = bygg_dataframe(alle_ord)
    if df.empty:
        print("Ingen ord funnet. PDF kan være skannet (kun bilder) eller tom.")
        print("Tips: Forsøk OCR-løsning (pytesseract/pdf2image) – se kommentar i koden.")
    else:
        # Sorter alfabetisk A-Å for hovedark
        df_alpha = df.sort_values(["Ord"]).reset_index(drop=True)
        # Også nyttige sorteringer
        df_len = df.sort_values(["Lengde", "Ord"])\
                   .reset_index(drop=True)
        df_freq = df.sort_values(["Frekvens", "Ord"], ascending=[False, True])\
                    .reset_index(drop=True)

        # Skriv til Excel med flere ark
        with pd.ExcelWriter(args.ut, engine="openpyxl") as xw:
            df_alpha.to_excel(xw, index=False, sheet_name="Ord (A-Å)")
            df_len.to_excel(xw, index=False, sheet_name="Ord etter lengde")
            df_freq.to_excel(xw, index=False, sheet_name="Ord etter frekvens")
        print(f"Skrev: {args.ut}")

        if args.lag_csv:
            csv_path = args.ut.with_suffix("")  # fjerner .xlsx
            # Legg på sufixer så vi ikke overskriver
            df_alpha.to_csv(args.ut.with_name(args.ut.stem + "_A-AA.csv"), index=False)
            df_len.to_csv(args.ut.with_name(args.ut.stem + "_LENGDE.csv"), index=False)
            df_freq.to_csv(args.ut.with_name(args.ut.stem + "_FREKVENS.csv"), index=False)
            print("Skrev CSV-varianter ved siden av .xlsx")

    print("Ferdig.")

if __name__ == "__main__":
    main()

# --------------------------------------------------------------
# OCR (valgfritt) – kun for skannede PDF-er (bilder, ingen tekstlag):
# --------------------------------------------------------------
# 1) Installer:
#    pip install pytesseract pdf2image pillow
#    + installer Tesseract engine på systemet:
#      - Windows (Chocolatey): choco install tesseract
#      - macOS (Homebrew):     brew install tesseract
#      - Linux (Debian/Ubuntu): sudo apt-get install tesseract-ocr
# 2) I stedet for pdfplumber, konverter sider til bilder (pdf2image)
#    og kjør pytesseract.image_to_string(image, lang="nor") per side.
# 3) Kombiner resultatene til én tekststreng og kjør ekstraher_ord som over.
# Merk: OCR krever at du også har POPPLER (for pdf2image) installert.
