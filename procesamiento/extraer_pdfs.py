#!/usr/bin/env python3
"""
Extrae los listados PDF de `RawData` (exportaciones del sistema "Red de atención"
de la Provincia) y se queda solo con los establecimientos de la Región Sanitaria VII.

NO agrega establecimientos nuevos al panel: el resultado se usa en `build_data.py`
para asignar servicios (categoría/subcategoría) a los establecimientos que YA están
en los Excel relevados.

Salida: procesamiento/servicios_pdf.json
    [{archivo, categoria, subcategoria, nombre, domicilio, partido}, ...]

Requiere `pdftotext` (poppler-utils).
"""
import json, os, re, subprocess, unicodedata

ROOT = os.path.dirname(os.path.abspath(__file__))
_CANDIDATAS = ["RawData", "drive-download-20260929T120752Z-1-001"]
SOURCE = next((os.path.abspath(os.path.join(ROOT, "..", "..", c)) for c in _CANDIDATAS
               if os.path.isdir(os.path.join(ROOT, "..", "..", c))),
              os.path.abspath(os.path.join(ROOT, "..", "..", "RawData")))
SALIDA = os.path.join(ROOT, "servicios_pdf.json")

# ---------------------------------------------------------------------------
# Qué servicio (de la taxonomía del proyecto) representa cada PDF.
# ⚠️ Mapeo a validar por el equipo de Salud Comunitaria.
# ---------------------------------------------------------------------------
PDF_SERVICIO = {
    "Salud sexual y reproductiva/acceso a aborto_.pdf":
        ("SALUD SEXUAL, REPRODUCTVA Y DE GÉNERO", "Anticoncepción / ILE-IVE"),
    "Salud sexual y reproductiva/acceso a profilaxis post exposición_.pdf":
        ("ENFERMEDADES TRANSMISIBLES", "VIH/ITS"),
    "Salud sexual y reproductiva/CENTROS DE ATENCIÓN DE GESTANTES Y EXPUESTOS PERINATALES AL _VIH.pdf":
        ("ENFERMEDADES TRANSMISIBLES", "VIH/ITS"),
    "Salud sexual y reproductiva/CENTROS DE ATENCIÓN DE NIÑXS QUE VIVEN CON VIH.pdf":
        ("ENFERMEDADES TRANSMISIBLES", "VIH/ITS"),
    "Salud sexual y reproductiva/CENTROS DE ATENCIÓN DE PERSONAS QUE VIVEN CON VIH.pdf":
        ("ENFERMEDADES TRANSMISIBLES", "VIH/ITS"),
    "Salud sexual y reproductiva/CENTROS DE TESTEO RÁPIDO DE VIH Y SÍFILIS.pdf":
        ("ENFERMEDADES TRANSMISIBLES", "VIH/ITS"),
    "Salud sexual y reproductiva/CENTROS DE DONACIÓN DE LECHE.pdf":
        ("POBLACIONES ESPECIFICAS", "Primera infancia"),
    "Salud sexual y reproductiva/o_ RED DE ESTABLECIMIENTOS DE ACCESO A ECOGRAFÍA OBSTÉTRICA.pdf":
        ("ATENCION CLÍNICA GENERAL (hospitalaria)", "GINECOLOGÍA Y OBSTETRICIA"),
    "Oncología/mamografia.pdf":
        ("ENFERMEDADES CRÓNICAS NO TRASMISIBLES", "Oncología (derivación)"),
    "Oncología/Ecografías mamarias.pdf":
        ("ENFERMEDADES CRÓNICAS NO TRASMISIBLES", "Oncología (derivación)"),
}
# Fuentes con formato propio (ver parse_ipc, parse_qunita, leer_transcripcion_upa):
IPC_SERVICIO = ("ENFERMEDADES CRÓNICAS NO TRASMISIBLES", "Oncología (derivación)")
QUNITA_SERVICIO = ("POBLACIONES ESPECIFICAS", "Primera infancia")
# No se usan: Oncología/ Hospitales.pdf (listado general de hospitales, sin servicio),
# hospitales-pciales-y-nac.pdf (solo dependencia provincial/nacional), CUD/*.jpg
# (capturas del trámite; única dirección: Junta Evaluadora de Hurlingham, que no es
# un establecimiento del listado).
# CAPS/Listado_establecimientos_*.pdf se usa SOLO para Tres de Febrero (ver parse_caps_3f).

RS7 = {"GENERAL LAS HERAS": "General Las Heras", "GENERAL RODRIGUEZ": "General Rodríguez",
       "HURLINGHAM": "Hurlingham", "ITUZAINGO": "Ituzaingó", "LUJAN": "Luján",
       "MARCOS PAZ": "Marcos Paz", "MERLO": "Merlo", "MORENO": "Moreno", "MORON": "Morón",
       "TRES DE FEBRERO": "Tres de Febrero"}

def norm(t):
    t = unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", t.upper()).strip()

def segmentos(linea):
    """[(columna_inicio, texto)] separando por 2+ espacios."""
    return [(m.start(), m.group().strip()) for m in re.finditer(r"\S+(?: \S+)*", linea)]

def parse_listado(path):
    txt = subprocess.run(["pdftotext", "-layout", path, "-"], capture_output=True, text=True).stdout
    recs, cols, cur = [], None, None
    for raw in txt.split("\n"):
        linea = raw.replace("\f", "")
        if linea.lstrip().startswith("Establecimiento") and "Domicilio" in linea:
            cols = [linea.index("Establecimiento"), linea.index("Domicilio"),
                    linea.index("Sitio web"), linea.index("Tel")]
            continue
        if cols is None or not linea.strip():
            continue
        partes = ["", "", "", ""]
        for pos, texto in segmentos(linea):
            # columna más cercana cuyo inicio esté a la izquierda (tolerancia 4)
            idx = max(i for i, c in enumerate(cols) if pos >= c - 4) if pos >= cols[0] - 4 else 0
            partes[idx] = (partes[idx] + " " + texto).strip()
        nombre, dom, tel = partes[0], partes[1], partes[3]
        dom_completo = cur is not None and re.search(r"\(\d*\)\s*$", cur["domicilio"])  # algunos registros traen el CP vacío: "()"
        if dom and (cur is None or dom_completo):
            cur = {"nombre": nombre, "domicilio": dom, "telefono": tel}
            recs.append(cur)
        elif cur is not None:
            if nombre: cur["nombre"] += " " + nombre
            if dom: cur["domicilio"] += " " + dom
            if tel: cur["telefono"] += " " + tel
    for r in recs:
        r["nombre"] = re.sub(r"\s+", " ", r["nombre"]).strip()
        r["domicilio"] = re.sub(r"\s+", " ", r["domicilio"]).strip()
        r["telefono"] = re.sub(r"\s+", " ", r.get("telefono", "")).strip() or "-"
        m = re.search(r",\s*([^,]+?)\s*\(\d*\)\s*$", r["domicilio"])
        r["partido"] = RS7.get(norm(m.group(1))) if m else None
    return recs

def _pdftotext(rel):
    return subprocess.run(["pdftotext", "-layout", os.path.join(SOURCE, rel), "-"],
                          capture_output=True, text=True).stdout

def parse_ipc(rel="Oncología/Establecimiento IPC.pdf"):
    """Tabla del Instituto Provincial del Cáncer: se toman las filas de la Región Sanitaria VII.
    Columnas: delegación | establecimiento | región | partido | localidad | domicilio |
    dependencia | banco de drogas | cuidados paliativos | radioterapia."""
    L, out = _pdftotext(rel).split("\n"), []
    for i, l in enumerate(L):
        seg = [m.group() for m in re.finditer(r"\S+(?: \S+)*", l)]
        if "VII" not in seg or seg.index("VII") < 2 or len(seg) < seg.index("VII") + 5:
            continue
        k = seg.index("VII")
        nombre, j = seg[k - 1], i + 1
        while j < len(L) and L[j].strip():          # el nombre sigue en las líneas de abajo
            cont = [m.group() for m in re.finditer(r"\S+(?: \S+)*", L[j]) if 20 <= m.start() < 80]
            if not cont:
                break
            nombre += " " + cont[0]; j += 1
        out.append({"nombre": re.sub(r"\s+", " ", nombre), "domicilio": seg[k + 3],
                    "partido": RS7.get(norm(seg[k + 1]))})
    return out

def parse_qunita(rel="Programa Qunita/HURLINGHAM.pdf"):
    """CAPS de Hurlingham del Programa Qunita: localidad | establecimiento | dirección."""
    L = _pdftotext(rel).split("\n")
    ini = next(i for i, l in enumerate(L) if "LOCALIDAD" in l)
    bloques, cur = [], []
    for l in L[ini + 1:]:
        if not l.strip():
            if cur: bloques.append(cur); cur = []
        else:
            cur.append(l)
    if cur: bloques.append(cur)
    out = []
    for b in bloques:
        cols = ["", "", ""]
        for l in b:
            for m in re.finditer(r"\S+(?: \S+)*", l):
                c = 0 if m.start() < 18 else (1 if m.start() < 45 else 2)
                cols[c] = (cols[c] + " " + m.group()).strip()
        if cols[1]:
            out.append({"nombre": cols[1], "domicilio": cols[2], "partido": "Hurlingham"})
    return out

def leer_transcripcion_upa(path=os.path.join(ROOT, "transcripcion_rs7_upa24.csv")):
    import csv
    return list(csv.DictReader(open(path, encoding="utf-8")))

def parse_caps_3f(rel="CAPS/Listado_establecimientos_1783203171444.pdf"):
    """El Excel de 1er nivel de Tres de Febrero en RawData es una copia del de Morón.
    Se reemplaza con los CAPS de Tres de Febrero del listado provincial de CAPS
    (misma fuente: sistema de la Provincia), que también está en RawData."""
    return [r for r in parse_listado(os.path.join(SOURCE, rel)) if r["partido"] == "Tres de Febrero"]

def main():
    out, resumen = [], []
    for rel, (cat, sub) in PDF_SERVICIO.items():
        path = os.path.join(SOURCE, rel)
        if not os.path.exists(path):
            print("  [AVISO] no existe", rel); continue
        recs = parse_listado(path)
        m = re.search(r"Resultados obtenidos:\s*(\d+)",
                      subprocess.run(["pdftotext", path, "-"], capture_output=True, text=True).stdout)
        esperado = int(m.group(1)) if m else None
        rs7 = [r for r in recs if r["partido"]]
        resumen.append((rel, esperado, len(recs), len(rs7)))
        for r in rs7:
            out.append({"archivo": rel, "categoria": cat, "subcategoria": sub, **r})
    # --- fuentes con formato propio
    extra = [("Oncología/Establecimiento IPC.pdf", IPC_SERVICIO, parse_ipc()),
             ("Programa Qunita/HURLINGHAM.pdf", QUNITA_SERVICIO, parse_qunita())]
    for rel, (cat, sub), recs in extra:
        rs7 = [r for r in recs if r["partido"]]
        resumen.append((rel, None, len(recs), len(rs7)))
        for r in rs7:
            out.append({"archivo": rel, "categoria": cat, "subcategoria": sub, **r})
    upa = leer_transcripcion_upa()
    resumen.append(("R.S VII .jpg (transcripción UPA 24 hs)", None, len(upa), len(upa)))
    for r in upa:
        out.append({"archivo": r["fuente"], "categoria": r["categoria"], "subcategoria": r["subcategoria"],
                    "nombre": r["nombre"], "domicilio": "", "partido": r["partido"]})
    json.dump(out, open(SALIDA, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    caps3f = parse_caps_3f()
    json.dump(caps3f, open(os.path.join(ROOT, "caps_tres_de_febrero.json"), "w", encoding="utf-8"),
              ensure_ascii=False, indent=1)
    print(f"CAPS de Tres de Febrero (listado provincial): {len(caps3f)} -> caps_tres_de_febrero.json")
    print(f"{'archivo':70s} esperados leidos RS7")
    for rel, e, n, k in resumen:
        flag = "" if e is None or e == n else "  <-- revisar"
        print(f"{rel[:70]:70s} {str(e):>9s} {n:>6d} {k:>4d}{flag}")
    print(f"\n{len(out)} filas RS VII -> {SALIDA}")

if __name__ == "__main__":
    main()
