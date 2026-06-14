import sqlite3

# Åpne databasen
conn = sqlite3.connect('ordliste_synonyms.sqlite3')
cursor = conn.cursor()

# Se alle tabeller
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
print("Tabeller i databasen:")
for table in tables:
    print(f"  - {table[0]}")

# Se strukturen på hver tabell
for table in tables:
    table_name = table[0]
    cursor.execute(f"PRAGMA table_info({table_name});")
    columns = cursor.fetchall()
    print(f"\nStruktur på '{table_name}':")
    for col in columns:
        print(f"  - {col[1]} ({col[2]})")

# Se hvor mange rader i hver tabell
for table in tables:
    table_name = table[0]
    cursor.execute(f"SELECT COUNT(*) FROM {table_name};")
    count = cursor.fetchone()[0]
    print(f"  Antall rader: {count}")

conn.close()