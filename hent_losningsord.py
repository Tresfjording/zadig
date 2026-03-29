import re

INN = "kryssord_uttrekk.txt"
UT = "kryssord_losningsord.txt"

def er_rutenett_linje(linje):
    # Typisk rutenett: mange mellomrom, ofte bindestreker, ofte > 20 tegn
    return (
        len(linje) > 20
        and re.fullmatch(r"[A-ZÆØÅ \-]+", linje)
        and linje.count(" ") > 5
    )

def er_losningsord(linje):
    # Løsningsord: kun store bokstaver og evt. mellomrom, minst 2 bokstaver
    linje = linje.strip()
    return (
        len(linje) > 1
        and re.fullmatch(r"[A-ZÆØÅ ]+", linje)
        and not er_rutenett_linje(linje)
    )

losningsord = []
with open(INN, encoding="utf-8") as f:
    for linje in f:
        linje = linje.strip()
        if not linje or linje.startswith("--- Side"):
            continue
        if er_losningsord(linje):
            losningsord.append(linje)

with open(UT, "w", encoding="utf-8") as f:
    for ord in losningsord:
        f.write(ord + "\n")

print(f"Fant {len(losningsord)} løsningsord. Lagret til {UT}")
