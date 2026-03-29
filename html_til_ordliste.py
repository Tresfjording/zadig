# Hent ut ord fra HTML-fil (kun ord med mer enn 3 bokstaver)
# Bruk: python html_til_ordliste.py --htmlfil sti_til_fil.html --utfil ordliste.txt

import argparse
from bs4 import BeautifulSoup
import re

parser = argparse.ArgumentParser(description="Trekk ut ord fra HTML-fil")
parser.add_argument("--htmlfil", type=str, required=True, help="Sti til HTML-fil")
parser.add_argument("--utfil", type=str, default="ordliste_fra_html.txt", help="Sti til utfil (txt)")
args = parser.parse_args()

with open(args.htmlfil, encoding="utf-8") as f:
    soup = BeautifulSoup(f, "html.parser")

# Hent ut all tekst
tekst = soup.get_text(separator=" ")

# Finn alle ord med minst 4 bokstaver (a-å, A-Å)
ord = re.findall(r"[a-zA-ZæøåÆØÅ]{4,}", tekst)

# Gjør om til små bokstaver og fjern duplikater
ordliste = sorted(set(o.lower() for o in ord))

with open(args.utfil, "w", encoding="utf-8") as f:
    for o in ordliste:
        f.write(o + "\n")

print(f"Ferdig! {len(ordliste)} ord skrevet til {args.utfil}")
