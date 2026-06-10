import sqlite3

path = r"c:\WS\LifeCity\data\SP_bairros_CD2022.gpkg"
conn = sqlite3.connect(path)
cur = conn.cursor()

cur.execute("SELECT table_name FROM gpkg_contents")
print("Layers:", cur.fetchall())

cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [
    r[0]
    for r in cur.fetchall()
    if not r[0].startswith(("gpkg_", "sqlite_", "rtree_"))
]
print("Tables:", tables)

for t in tables:
    cur.execute(f"PRAGMA table_info({t})")
    cols = [c[1] for c in cur.fetchall()]
    print(f"\n{t}: {cols}")
    mun_cols = [c for c in cols if "mun" in c.lower()]
    for col in mun_cols:
        cur.execute(f"SELECT COUNT(*) FROM {t} WHERE {col} = '3509502'")
        print(f"  {col}=3509502 -> {cur.fetchone()[0]} rows")
        if cur.fetchone is not None:
            cur.execute(
                f"SELECT {col}, COUNT(*) FROM {t} GROUP BY {col} ORDER BY 2 DESC LIMIT 3"
            )
            print("  top municipalities:", cur.fetchall())

conn.close()
