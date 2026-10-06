#!/usr/bin/env python3
"""
Pipeline de procesamiento de datos — Panel de Salud Comunitaria (Región Sanitaria VII).

Lee los archivos relevados por el equipo de Salud Comunitaria y produce la base de
datos normalizada y georreferenciada que consume el panel web.

Entradas (carpeta `drive-download-...`):
  * DATOS VINCULADOS A LA TABLA/**/*.xlsx  -> efectores de salud (1º/2º/3º nivel) y nutrición
  * REPOSITORIO DE ENLACES GEOREF.xlsx      -> taxonomía categoría/subcategoría/municipio

Salidas (carpeta `data/`):
  * municipios.json   -> 10 municipios de la RS VII con coordenadas de referencia
  * efectores.json    -> efectores normalizados + georreferenciados
  * taxonomia.json    -> categorías y subcategorías
  * resumen.json      -> conteos y métricas
"""
import json, os, re, time, glob, urllib.parse, urllib.request, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SOURCE = os.path.abspath(os.path.join(ROOT, "..", "..", "drive-download-20260929T120752Z-1-001"))
DATA = os.path.join(ROOT, "..", "data")
CACHE = os.path.join(ROOT, "geocode_cache.json")

os.makedirs(DATA, exist_ok=True)

# ---------------------------------------------------------------------------
# 1) Nombres canónicos de municipios (Región Sanitaria VII)
# ---------------------------------------------------------------------------
MUNICIPIOS_CANON = {
    "HURLINGHAM": "Hurlingham",
    "ITUZAINGO": "Ituzaingó",
    "ITUZAINGÓ": "Ituzaingó",
    "MORON": "Morón",
    "MORÓN": "Morón",
    "MERLO": "Merlo",
    "MORENO": "Moreno",
    "TRES DE FEBRERO": "Tres de Febrero",
    "GENERAL RODRIGUEZ": "General Rodríguez",
    "GENERAL RODRÍGUEZ": "General Rodríguez",
    "GENERAL LAS HERAS": "General Las Heras",
    "MARCOS PAZ": "Marcos Paz",
    "LUJAN": "Luján",
    "LUJÁN": "Luján",
}

def canon_mun(raw):
    if not raw:
        return ""
    r = raw.strip().upper()
    for k, v in MUNICIPIOS_CANON.items():
        if r == k or r.startswith(k):
            return v
    return raw.strip().title()

# ---------------------------------------------------------------------------
# 2) Geocodificación (Nominatim / OpenStreetMap) con caché y rate-limit
# ---------------------------------------------------------------------------
def load_cache():
    if os.path.exists(CACHE):
        return json.load(open(CACHE))
    return {}

def save_cache(c):
    json.dump(c, open(CACHE, "w"), ensure_ascii=False, indent=1)

cache = load_cache()

def geocode(query, country="Argentina", sleep=1.1):
    key = query.strip().lower()
    if key in cache:
        return cache[key]
    params = urllib.parse.urlencode({"q": query, "format": "json", "limit": 1, "countrycodes": "ar"})
    url = "https://nominatim.openstreetmap.org/search?" + params
    req = urllib.request.Request(url, headers={"User-Agent": "salud-comunitaria-demo/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode())
        if data:
            res = {"lat": float(data[0]["lat"]), "lon": float(data[0]["lon"]),
                   "display_name": data[0].get("display_name", "")}
        else:
            res = None
    except Exception as e:
        res = {"error": str(e)}
    cache[key] = res
    save_cache(cache)
    time.sleep(sleep)
    return res

# ---------------------------------------------------------------------------
# 3) Extracción de xlsx
# ---------------------------------------------------------------------------
import openpyxl

def extract_xlsx(path):
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    meta, data, header_idx = {}, [], None
    for i, row in enumerate(rows):
        cells = [str(c).strip() if c is not None else '' for c in row]
        if cells and cells[0] in ('Establecimiento', 'Nombre', 'NOMBRE', 'ESTABLECIMIENTO'):
            header_idx = i
            break
        joined = " ".join(cells)
        m = re.match(r'^Partido:\s*(.*)$', joined, re.I)
        if m: meta['partido'] = m.group(1).strip()
        m = re.match(r'^(Tipo de establecimiento|Especialidad):\s*(.*)$', joined, re.I)
        if m: meta['tipo'] = m.group(2).strip()
        m = re.match(r'^Resultados obtenidos:\s*(\d+)$', joined, re.I)
        if m: meta['resultados'] = int(m.group(1))
    if header_idx is None:
        return meta, []
    headers = [str(c).strip() if c is not None else '' for c in rows[header_idx]]
    for row in rows[header_idx+1:]:
        vals = [str(c).strip() if c is not None else '' for c in row]
        if not any(vals): continue
        rec = dict(zip(headers, vals))
        if not rec.get('Establecimiento') and not rec.get('Nombre'):
            continue
        data.append(rec)
    return meta, data

def classify(path):
    p = path.replace('\\', '/')
    cat = sub = nivel = None
    if 'EFECTORES DE SALUD PUBLICA' in p:
        cat = 'EFECTORES DE SALUD PÚBLICA'
        if 'PRIMER NIVEL' in p: nivel = 'Primer Nivel'
        elif 'SEGUNDO NIVEL' in p: nivel = 'Segundo Nivel'
        elif 'TERCER NIVEL' in p: nivel = 'Tercer Nivel'
        sub = nivel
    elif 'NUTRICIÓN Y ALIMENTACIÓN' in p or 'NUTRICION' in p:
        cat = 'NUTRICIÓN Y ALIMENTACIÓN'
        sub = 'Consultorios de nutrición'
    return cat, sub, nivel

def extract_efectores():
    files = glob.glob(os.path.join(SOURCE, "DATOS VINCULADOS A LA TABLA", "**", "*.xlsx"), recursive=True)
    recs = []
    for f in sorted(files):
        cat, sub, nivel = classify(f)
        meta, data = extract_xlsx(f)
        partido = canon_mun(meta.get('partido', ''))
        for rec in data:
            recs.append({
                'nombre': (rec.get('Establecimiento') or rec.get('Nombre') or '').strip(),
                'domicilio': (rec.get('Domicilio') or '').strip(),
                'telefono': (rec.get('Tel. Contacto') or rec.get('Tel') or '').strip(),
                'sitio_web': (rec.get('Sitio web') or '').strip(),
                'partido': partido,
                'categoria': cat,
                'subcategoria': sub,
                'nivel': nivel,
            })
    # deduplicar por nombre+domicilio
    seen, dedup = set(), []
    for r in recs:
        k = (r['nombre'].upper(), r['domicilio'].upper())
        if k in seen: continue
        seen.add(k)
        dedup.append(r)
    return dedup

# ---------------------------------------------------------------------------
# 4) Limpieza de domicilio para geocodificación
# ---------------------------------------------------------------------------
def clean_address(domicilio, partido):
    d = domicilio
    # quitar el sufijo "- MUNICIPIO, MUNICIPIO (CP)"
    d = re.sub(r'\s*-\s*[^,]+,\s*[^()]*\(\d+\)\s*$', '', d)
    d = re.sub(r'\(\d{4}\)\s*$', '', d)
    d = d.replace(' - ', ', ').replace('  ', ' ').strip(' ,-')
    if not d:
        return None
    return f"{d}, {partido}, Buenos Aires, Argentina"

# ---------------------------------------------------------------------------
# 5) Orquestación
# ---------------------------------------------------------------------------
def main():
    do_geocode = "--geocode" in sys.argv
    print("Extrayendo efectores...")
    efectores = extract_efectores()
    print(f"  {len(efectores)} efectores (deduplicados)")

    # Municipios
    munis = sorted(set(r['partido'] for r in efectores if r['partido']))
    municipios = []
    for m in munis:
        coord = geocode(f"{m}, Buenos Aires, Argentina") if do_geocode else None
        municipios.append({
            'nombre': m,
            'lat': coord['lat'] if coord else None,
            'lon': coord['lon'] if coord else None,
            'display_name': coord.get('display_name', '') if coord else '',
        })
    print(f"  {len(municipios)} municipios georreferenciados")

    # Coordenadas por municipio (para fallback)
    mun_coord = {m['nombre']: (m['lat'], m['lon']) for m in municipios}

    # Georreferenciar efectores
    n_geo = 0
    for i, r in enumerate(efectores):
        q = clean_address(r['domicilio'], r['partido'])
        coord = None
        if do_geocode and q:
            coord = geocode(q)
        if coord and 'lat' in coord:
            r['lat'] = coord['lat']
            r['lon'] = coord['lon']
            r['geo_origen'] = 'domicilio'
            n_geo += 1
        else:
            # fallback: centroide del municipio + jitter determinístico
            mc = mun_coord.get(r['partido'])
            if mc and mc[0] is not None:
                seed = sum(ord(c) for c in r['nombre'])
                jitter = ((seed % 100) / 10000.0) - 0.005
                r['lat'] = round(mc[0] + jitter, 5)
                r['lon'] = round(mc[1] + jitter * 0.7, 5)
                r['geo_origen'] = 'centroide_municipio'
            else:
                r['lat'] = None
                r['lon'] = None
                r['geo_origen'] = 'sin_geo'
        if i % 50 == 0:
            print(f"    geocodificando {i}/{len(efectores)}...")

    if do_geocode:
        print(f"  georreferenciados por domicilio: {n_geo}/{len(efectores)}")

    # Taxonomía
    tax = build_taxonomia()

    # Resumen
    from collections import Counter
    resumen = {
        'total_efectores': len(efectores),
        'total_municipios': len(municipios),
        'por_municipio': dict(Counter(r['partido'] for r in efectores)),
        'por_categoria': dict(Counter(r['categoria'] for r in efectores)),
        'por_nivel': dict(Counter(r['nivel'] if r['nivel'] else 'Consultorios (nutrición)' for r in efectores)),
        'categorias': len(tax),
    }

    # Escribir salidas
    json.dump(municipios, open(os.path.join(DATA, "municipios.json"), "w"), ensure_ascii=False, indent=1)
    json.dump(efectores, open(os.path.join(DATA, "efectores.json"), "w"), ensure_ascii=False, indent=1)
    json.dump(tax, open(os.path.join(DATA, "taxonomia.json"), "w"), ensure_ascii=False, indent=1)
    json.dump(resumen, open(os.path.join(DATA, "resumen.json"), "w"), ensure_ascii=False, indent=1)
    print("\nResumen:")
    print(json.dumps(resumen, ensure_ascii=False, indent=2))
    print("\nSalidas escritas en", DATA)

def build_taxonomia():
    import openpyxl
    wb = openpyxl.load_workbook(os.path.join(SOURCE, "REPOSITORIO DE ENLACES GEOREF.xlsx"), data_only=True)
    ws = wb['Hoja 1']
    tax, cur = {}, None
    for row in ws.iter_rows(values_only=True):
        c, s, a, m, e, o = row
        if c and c not in ('CATEGORIA',):
            if c not in tax:
                tax[c] = {}
            cur = c
        if s and s not in ('SUBCATEGORIA',) and cur and s:
            if s not in tax[cur]:
                tax[cur][s] = set()
            if m and m not in ('MUNICIPIO',):
                tax[cur][s].add(canon_mun(m))
    out = []
    for c, subs in tax.items():
        out.append({'categoria': c, 'subcategorias': [
            {'nombre': s, 'municipios': sorted(munis)} for s, munis in subs.items()
        ]})
    return out

if __name__ == "__main__":
    main()
