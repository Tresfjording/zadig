import sqlite3

DB_FIL = "ordliste_cache.sqlite3"
UT_FIL = "ordliste_fra_sqlite.txt"

con = sqlite3.connect(DB_FIL)
cur = con.cursor()

with open(UT_FIL, "w", encoding="utf-8") as f:
    for row in cur.execute("SELECT word FROM words ORDER BY word ASC"):
        f.write(row[0] + "\n")

con.close()
print(f"Alle ord er lagret til {UT_FIL}")
