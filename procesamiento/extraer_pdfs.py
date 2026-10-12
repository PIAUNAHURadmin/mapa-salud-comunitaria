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
# No se usan: CAPS/*.pdf (ya cubiertos por los Excel), Oncología/ Hospitales.pdf (listado
# general de hospitales, no de oncología), Oncología/Establecimiento IPC.pdf y
# Hosp. Provinciales y Nacionales (formato distinto, pendiente), Programa Qunita (idem).

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
        nombre, dom = partes[0], partes[1]
        dom_completo = cur is not None and re.search(r"\(\d{4}\)\s*$", cur["domicilio"])
        if dom and (cur is None or dom_completo):
            cur = {"nombre": nombre, "domicilio": dom}
            recs.append(cur)
        elif cur is not None:
            if nombre: cur["nombre"] += " " + nombre
            if dom: cur["domicilio"] += " " + dom
    for r in recs:
        r["nombre"] = re.sub(r"\s+", " ", r["nombre"]).strip()
        r["domicilio"] = re.sub(r"\s+", " ", r["domicilio"]).strip()
        m = re.search(r",\s*([^,]+?)\s*\(\d{4}\)\s*$", r["domicilio"])
        r["partido"] = RS7.get(norm(m.group(1))) if m else None
    return recs

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
    json.dump(out, open(SALIDA, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{'archivo':70s} esperados leidos RS7")
    for rel, e, n, k in resumen:
        flag = "" if e == n else "  <-- revisar"
        print(f"{rel[:70]:70s} {str(e):>9s} {n:>6d} {k:>4d}{flag}")
    print(f"\n{len(out)} filas RS VII -> {SALIDA}")

if __name__ == "__main__":
    main()
