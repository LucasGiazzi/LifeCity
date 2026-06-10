import re
import subprocess

base = "https://zoneamento.campinas.sp.gov.br/novo_zoneamento/exporta_shp.php?id="
layers = []

for i in range(1, 121):
    html = subprocess.check_output(
        ["curl.exe", "-s", f"{base}{i}"], timeout=30
    ).decode("latin1", "replace")
    if "Camada:" not in html:
        continue
    m = re.search(r"Camada:\s*<b>([^<]+)</b>", html)
    rows = re.search(r"Dumping:.*?(\d+)\s*rows", html)
    if m:
        layers.append(
            {
                "id": i,
                "name": m.group(1).strip(),
                "rows": int(rows.group(1)) if rows else None,
            }
        )

keywords = [
    "bair",
    "utb",
    "utr",
    "territ",
    "distrito",
    "setor",
    "macro",
    "apg",
    "limite",
    "municip",
    "cadastro",
    "lote",
    "quadra",
]

print("Relevant layers:")
for layer in layers:
    name_lower = layer["name"].lower()
    if any(k in name_lower for k in keywords):
        print(f"ID {layer['id']:3d} | rows={layer['rows']} | {layer['name']}")

print(f"\nTotal exportable layers found: {len(layers)}")
