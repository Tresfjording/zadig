import pdfplumber
from pathlib import Path

# Sett inn din PDF-fil her
PDF_FIL = r"Schive Kryssord - Tankespinn #737.pdf"
UTFIL = "kryssord_uttrekk.txt"

pdf_path = Path(PDF_FIL)
if not pdf_path.is_file():
    print(f"Fant ikke PDF: {pdf_path}")
    exit(1)

with pdfplumber.open(pdf_path) as pdf:
    all_text = []
    for i, page in enumerate(pdf.pages):
        text = page.extract_text()
        if text:
            all_text.append(f"--- Side {i+1} ---\n{text}\n")

if not all_text:
    print("Fant ingen tekst i PDF-en. Kanskje det er et bilde/skannet dokument?")
else:
    with open(UTFIL, "w", encoding="utf-8") as f:
        f.writelines(all_text)
    print(f"Tekst fra PDF lagret til {UTFIL}")
    print("Sjekk denne filen og lim inn et lite utdrag her, så kan jeg hjelpe deg videre med å hente ut løsningsordene!")
