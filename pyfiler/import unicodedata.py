import unicodedata

def normaliser_filnavn(filnavn):
    return unicodedata.normalize("NFKD", filnavn).encode("ascii", "ignore").decode()