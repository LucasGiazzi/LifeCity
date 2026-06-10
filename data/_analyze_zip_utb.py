import struct
from collections import Counter

path = r"c:\WS\LifeCity\data\pd2018_utbs\pd2018_utb.dbf"

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
print("Sample row 1:", rows[0])
print("Unique UTB_SIGLA:", len({r.get("UTB_SIGLA", r.get("UTB", "")) for r in rows}))

if any("BAIRRO" in k for k in rows[0]):
    bairro_field = next(k for k in rows[0] if "BAIRRO" in k)
    parts = Counter()
    for row in rows:
        for part in row[bairro_field].split("/"):
            parts[part.strip()] += 1
    print(f"Field {bairro_field} unique tokens:", len(parts))
    print("Top 10:", parts.most_common(10))
