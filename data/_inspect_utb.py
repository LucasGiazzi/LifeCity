import struct
from collections import defaultdict

path = r"c:\WS\LifeCity\data\staging\pd2018_utbs\pd2018_utb.dbf"

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

by_sigla = defaultdict(list)
for row in rows:
    by_sigla[row["utb_sigla"]].append(row)

print("records", nrec, "unique utb_sigla", len(by_sigla))
for sigla in sorted(by_sigla)[:5]:
    print(sigla, "rows", len(by_sigla[sigla]), "denom", by_sigla[sigla][0]["denominaca"])
