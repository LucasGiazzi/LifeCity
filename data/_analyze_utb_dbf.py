import struct
from collections import Counter

path = r"c:\WS\LifeCity\data\campinas-utb\395bd7b9-28b3-cf08-52d1-00006c2b8c1d.dbf"

with open(path, "rb") as f:
    header = f.read(32)
    nrec = struct.unpack("<I", header[4:8])[0]
    hlen = struct.unpack("<H", header[8:10])[0]
    rlen = struct.unpack("<H", header[10:12])[0]

    fields = []
    f.seek(32)
    while True:
        desc = f.read(32)
        if desc[0] == 0x0D:
            break
        name = desc[:11].split(b"\x00")[0].decode("latin1")
        flen = desc[16]
        fields.append((name, flen))

    f.seek(hlen)
    rows = []
    for _ in range(nrec):
        row = f.read(rlen)
        pos = 1
        item = {}
        for name, flen in fields:
            item[name] = row[pos : pos + flen].decode("latin1", "replace").strip()
            pos += flen
        rows.append(item)

print("Records:", nrec)
print("Fields:", [f[0] for f in fields])
print("Unique UTB_SIGLA:", len({r["UTB_SIGLA"] for r in rows}))
print("Sample names:")
for row in rows[:8]:
    print(f"  {row['UTB_SIGLA']:8} -> {row['DENOMINACA']}")

# split combined neighborhood names
parts = Counter()
for row in rows:
    for part in row["DENOMINACA"].split("/"):
        parts[part.strip()] += 1
print("\nSplit neighborhood-like tokens:", len(parts))
print("Top 15:", parts.most_common(15))
