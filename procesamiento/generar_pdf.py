#!/usr/bin/env python3
"""Genera un PDF de documentación para la presentación en las Jornadas de Salud
Comunitaria. Construye un HTML (tema claro, optimizado para impresión) con el
logo embebido en base64 y lo convierte a PDF con Chrome headless."""
import base64, json, os, subprocess

ROOT = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(ROOT)  # panel-salud-comunitaria
DOCS = os.path.join(BASE, "docs")

def b64(path):
    with open(path, "rb") as f:
        return "data:image/png;base64," + base64.b64encode(f.read()).decode()

LOGO = b64(os.path.join(BASE, "assets", "img", "logo-unahur.png"))

resumen = json.load(open(os.path.join(BASE, "data", "resumen.json")))
por_mun = resumen["por_municipio"]
orden_mun = ["Hurlingham", "Ituzaingó", "Morón", "Merlo", "Moreno",
             "Tres de Febrero", "General Rodríguez", "General Las Heras",
             "Marcos Paz", "Luján"]
pares = [(orden_mun[i], orden_mun[i+1]) for i in range(0, len(orden_mun), 2)]
filas_mun = "".join(
    f"<tr><td>{a}</td><td class='num'>{por_mun.get(a,0)}</td>"
    f"<td>{b}</td><td class='num'>{por_mun.get(b,0)}</td></tr>" for a, b in pares
)

css = """
:root{--verde:#0b7a4b;--borde:#e2e8f0;--fondo:#f8fafc;}
*{box-sizing:border-box}
body{font-family:'DejaVu Sans',Arial,sans-serif;color:#1a2332;margin:0;font-size:11pt;line-height:1.5}
.pagina{padding:24mm 20mm}
.portada{page-break-after:always}
.portada .contenido{display:flex;flex-direction:column;justify-content:center;min-height:68vh}
.portada .logo{margin-bottom:24pt}
.portada .logo img{height:52px}
.titulo{font-size:30pt;font-weight:700;color:var(--verde);line-height:1.15;margin:0 0 10pt}
.subtitulo{font-size:14pt;color:#334;margin:0 0 4pt}
.meta{margin-top:28pt;font-size:10pt;color:#5b6673;border-top:1px solid var(--borde);padding-top:10pt}
.badge{display:inline-block;background:#fef3c7;color:#92400e;border:1px solid #f59e0b;border-radius:4px;padding:2pt 8pt;font-size:9pt;font-weight:600;margin-bottom:10pt}
h1{font-size:24pt;margin:0 0 4pt;color:var(--verde)}
h2{font-size:16pt;color:var(--verde);border-bottom:2px solid var(--verde);padding-bottom:4pt;margin:0 0 10pt;page-break-before:always}
h3{font-size:12pt;margin:14pt 0 4pt;color:#0b3d2a}
p{margin:6pt 0}
table{width:100%;border-collapse:collapse;margin:8pt 0;font-size:9.5pt;page-break-inside:avoid}
th,td{border:1px solid var(--borde);padding:5pt 7pt;text-align:left}
th{background:var(--fondo);color:#0b3d2a}
td.num{text-align:center;font-variant-numeric:tabular-nums}
.small{font-size:9pt;color:#5b6673}
.muted{color:#5b6673}
.fila{display:flex;gap:16pt;margin:14pt 0;page-break-inside:avoid}
.caja{flex:1;background:var(--fondo);border:1px solid var(--borde);border-radius:8px;padding:12pt}
.caja .n{font-size:22pt;font-weight:700;color:var(--verde)}
.caja .l{font-size:9pt;color:#5b6673}
.dos-col{display:flex;gap:16pt;page-break-inside:avoid}
.dos-col>div{flex:1}
ul{margin:4pt 0 4pt 16pt;padding:0;page-break-inside:avoid}
li{margin:2pt 0}
code{background:#eef2f6;padding:1pt 4pt;border-radius:3px;font-size:9pt}
.aviso{background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:10pt;color:#7f1d1d;font-size:9.5pt;page-break-inside:avoid}
"""

html = f"""<!doctype html><html lang="es"><head><meta charset="utf-8">
<style>{css}</style></head><body>

<!-- PORTADA -->
<div class="pagina portada"><div class="contenido">
  <div class="logo"><img src="{LOGO}" alt="UNAHUR"></div>
  <span class="badge">Versión DEMO</span>
  <h1 class="titulo">Panel de Salud Comunitaria</h1>
  <p class="subtitulo">Panel interactivo georreferenciado de servicios públicos de salud</p>
  <p class="subtitulo muted">Región Sanitaria VII · Conurbano Bonaerense</p>
  <p>Proyecto interdisciplinario entre <strong>Salud Comunitaria</strong> e
     <strong>Inteligencia Artificial</strong> — Universidad Nacional de Hurlingham.</p>
  <div class="meta">
    Documentación técnica para las Jornadas de Salud Comunitaria · 15 de octubre<br>
    Sitio web publicado (Hosting): <strong>https://piaunahuradmin.github.io/mapa-salud-comunitaria/</strong><br>
    Acompaña al prototipo interactivo (index.html)
  </div>
</div></div>

<!-- 1. RESUMEN -->
<div class="pagina">
  <h2>1. Resumen del proyecto</h2>
  <p>El objetivo es reducir la <strong>barrera de accesibilidad informacional</strong>: que cualquier
  persona sepa qué servicio de salud público existe, dónde está y si responde a su necesidad concreta.
  El panel permite ubicar los efectores de la Región Sanitaria VII según la <strong>ubicación</strong>
  del usuario y su <strong>necesidad específica</strong> (disciplina o problemática de salud).</p>

  <div class="fila">
    <div class="caja"><div class="n">{resumen['total_efectores']}</div><div class="l">efectores relevados</div></div>
    <div class="caja"><div class="n">10</div><div class="l">municipios (RS VII)</div></div>
    <div class="caja"><div class="n">13</div><div class="l">categorías de atención</div></div>
    <div class="caja"><div class="n">45</div><div class="l">subcategorías / disciplinas</div></div>
  </div>

  <h3>Funcionalidades del panel</h3>
  <ul>
    <li>Mapa interactivo con puntos por nivel de atención y disciplina.</li>
    <li>Filtros por <strong>categoría → servicio → municipio</strong> y búsqueda por texto libre.</li>
    <li>Indicación de la ubicación del usuario (GPS, domicilio o clic en el mapa).</li>
    <li>Ordenamiento de resultados por <strong>distancia</strong> (kilómetros/metros).</li>
    <li>Detalle de cada efector: domicilio, teléfono y nivel de atención.</li>
    <li><strong>Ruteo en transporte público (colectivos)</strong>: trazado real sobre la red de calles y avenidas (OSRM), líneas de colectivo comunales e interurbanas sugeridas según el origen y destino, guía de navegación paso a paso con puntos de trasbordo y enlaces parametrizados a Google Maps y Moovit.</li>
  </ul>

  <h3>Alcance territorial — Región Sanitaria VII</h3>
  <table>
    <thead><tr><th>Municipio</th><th>Nº</th><th>Municipio</th><th>Nº</th></tr></thead>
    <tbody>{filas_mun}</tbody>
  </table>
</div>

<!-- 2. DATOS -->
<div class="pagina">
  <h2>2. Datos procesados</h2>
  <p>La base consolidada se generó a partir del relevamiento tabular de los estudiantes
  (archivos Excel por municipio). Se normalizó y georreferenció cada establecimiento.</p>

  <h3>Composición de la base</h3>
  <div class="dos-col">
    <div>
      <table>
        <thead><tr><th>Categoría</th><th class="num">Registros</th></tr></thead>
        <tbody>
          <tr><td>Efectores de salud pública</td><td class="num">229</td></tr>
          <tr><td>Nutrición y alimentación</td><td class="num">84</td></tr>
          <tr><td class="muted">Total efectores</td><td class="num"><strong>313</strong></td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <table>
        <thead><tr><th>Nivel de atención</th><th class="num">Cantidad</th></tr></thead>
        <tbody>
          <tr><td>Primer Nivel (CAPS)</td><td class="num">196</td></tr>
          <tr><td>Segundo Nivel (hospitales)</td><td class="num">30</td></tr>
          <tr><td>Tercer Nivel (alta complejidad)</td><td class="num">3</td></tr>
          <tr><td>Consultorios de nutrición</td><td class="num">84</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <h3>Diccionario de datos (campo por campo)</h3>
  <table>
    <thead><tr><th>Campo</th><th>Descripción</th></tr></thead>
    <tbody>
      <tr><td><code>nombre</code></td><td>Nombre del establecimiento.</td></tr>
      <tr><td><code>domicilio</code></td><td>Dirección declarada en la fuente.</td></tr>
      <tr><td><code>telefono</code> / <code>sitio_web</code></td><td>Contacto (<code>-</code> si no figura).</td></tr>
      <tr><td><code>partido</code></td><td>Municipio normalizado.</td></tr>
      <tr><td><code>categoria</code> / <code>subcategoria</code></td><td>Clasificación del servicio.</td></tr>
      <tr><td><code>nivel</code></td><td>Nivel de atención (solo efectores de salud).</td></tr>
      <tr><td><code>lat</code> / <code>lon</code></td><td>Coordenadas geográficas (WGS84).</td></tr>
      <tr><td><code>geo_origen</code></td><td><code>domicilio</code> (exacto) o <code>centroide_municipio</code> (aproximado).</td></tr>
    </tbody>
  </table>

  <h3>Base de transporte público (<code>colectivos.json/.js</code>)</h3>
  <p class="small">Contiene el catálogo de líneas de colectivos comunales e interurbanas de los 10 municipios de la RS VII, discriminando ramales, tipo de servicio y la matriz de cruces interurbanos directos entre partidos contiguos.</p>
</div>

<!-- 3. METODOLOGÍA -->
<div class="pagina">
  <h2>3. Metodología</h2>

  <h3>Fuentes</h3>
  <p>Listados oficiales de establecimientos del Ministerio de Salud de la Provincia de Buenos Aires
  (<code>sistemas.ms.gba.gov.ar/redatencion</code>), relevados por el equipo de Salud Comunitaria en 2026.
  Se complementa con el índice de enlaces (<code>REPOSITORIO DE ENLACES GEOREF.xlsx</code>) y documentos
  de marco del proyecto.</p>

  <h3>Procesamiento</h3>
  <ul>
    <li><strong>Extracción</strong>: lectura de los 32 archivos Excel y estructuración en una tabla única.</li>
    <li><strong>Normalización</strong>: unificación de nombres de municipio (acentos, mayúsculas) y deduplicación.</li>
    <li><strong>Georreferenciación</strong>: resolución de domicilios con OpenStreetMap / Nominatim.</li>
    <li><strong>Taxonomía</strong>: 13 categorías y 45 subcategorías a partir del repositorio de enlaces.</li>
    <li><strong>Transporte y movilidad</strong>: modelado de líneas comunales e interurbanas de la RS VII y trazado vial interactivo con OSRM.</li>
  </ul>

  <h3>Georreferenciación — transparencia</h3>
  <table>
    <thead><tr><th>Método</th><th class="num">Efectores</th></tr></thead>
    <tbody>
      <tr><td>Domicilio resuelto (coordenada exacta)</td><td class="num">130</td></tr>
      <tr><td>Centroide del municipio (aproximado)</td><td class="num">183</td></tr>
    </tbody>
  </table>
  <p class="small">Los puntos ubicados en el centro del municipio son una <strong>referencia</strong>, no la
  posición exacta del establecimiento. Esta distinción se documenta en el campo <code>geo_origen</code> y
  se aclara en la leyenda del panel.</p>

  <div class="aviso">
    <strong>Limitaciones de esta versión DEMO:</strong> las categorías de oncología, salud sexual/VIH,
    salud mental y hospitales provinciales existen en los PDF provinciales pero aún no están desagregadas
    por municipio. Los horarios, turnos y requisitos están pendientes de validación territorial.
  </div>
</div>

<!-- 4. ENTREGABLE -->
<div class="pagina">
  <h2>4. Estructura del entregable</h2>
  <table>
    <thead><tr><th>Carpeta / archivo</th><th>Contenido</th></tr></thead>
    <tbody>
      <tr><td><code>index.html</code></td><td>Panel interactivo (abrir con doble clic).</td></tr>
      <tr><td><code>assets/</code></td><td>Estilos (CSS compilado tema oscuro <code>salud</code>), lógica del mapa y ruteo (JS) e imágenes.</td></tr>
      <tr><td><code>data/</code></td><td>Base de datos normalizada (efectores, municipios, taxonomía y colectivos en JSON + JS).</td></tr>
      <tr><td><code>docs/</code></td><td>Documentación: README, diccionario de datos, proceso, fuentes y PDF.</td></tr>
      <tr><td><code>procesamiento/</code></td><td>Scripts de extracción, geocodificación, exportación y generación documental.</td></tr>
    </tbody>
  </table>

  <h3>Despliegue y Hosting</h3>
  <p>El panel interactivo se encuentra publicado y disponible públicamente en la nube a través de <strong>GitHub Pages</strong>:</p>
  <p><a href="https://piaunahuradmin.github.io/mapa-salud-comunitaria/" style="color:var(--verde);font-weight:bold;text-decoration:none;">https://piaunahuradmin.github.io/mapa-salud-comunitaria/</a></p>

  <h3>Tecnologías</h3>
  <table>
    <thead><tr><th>Capa</th><th>Tecnología</th></tr></thead>
    <tbody>
      <tr><td>Hosting</td><td>GitHub Pages (<a href="https://piaunahuradmin.github.io/mapa-salud-comunitaria/">piaunahuradmin.github.io/mapa-salud-comunitaria</a>)</td></tr>
      <tr><td>Interfaz</td><td>HTML + daisyUI / Tailwind CSS (tema oscuro personalizado <code>salud</code>)</td></tr>
      <tr><td>Mapa</td><td>Leaflet + teselas Esri Dark Gray Canvas</td></tr>
      <tr><td>Ruteo vial</td><td>OSRM (OpenStreetMap Routing) para trazado sobre calles y avenidas</td></tr>
      <tr><td>Datos</td><td>JSON estático embebido (sin backend ni dependencias de runtime)</td></tr>
      <tr><td>Geocodificación</td><td>Nominatim / OpenStreetMap</td></tr>
      <tr><td>Procesamiento</td><td>Python (openpyxl, urllib, json)</td></tr>
    </tbody>
  </table>

  <h2>5. Próximos pasos</h2>
  <ul>
    <li>Desagregar los PDF provinciales (oncología, VIH, salud sexual, hospitales) a la RS VII.</li>
    <li>Validar direcciones, horarios y requisitos con los equipos territoriales.</li>
    <li>Evaluar integración de buscador conversacional asistido por IA sobre los efectores georreferenciados.</li>
    <li>Monitorear uso y analíticas en la URL pública de GitHub Pages (<code>https://piaunahuradmin.github.io/mapa-salud-comunitaria/</code>).</li>
  </ul>
</div>

</body></html>"""

out_html = os.path.join(DOCS, "documentacion.html")
out_pdf = os.path.join(DOCS, "Documentacion_Panel_Salud_Comunitaria.pdf")
open(out_html, "w", encoding="utf-8").write(html)

def find_browser():
    candidates = [
        "google-chrome",
        "chrome",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    ]
    for c in candidates:
        if os.path.isabs(c) and os.path.exists(c):
            return c
        elif subprocess.run(["where", c] if os.name == "nt" else ["which", c],
                            capture_output=True).returncode == 0:
            return c
    return None

browser = find_browser()
if browser:
    cmd = [
        browser, "--headless", "--disable-gpu", "--no-sandbox",
        "--no-pdf-header-footer",
        f"--print-to-pdf={out_pdf}",
        f"file:///{os.path.abspath(out_html).replace(os.sep, '/')}",
    ]
    res = subprocess.run(cmd, capture_output=True, timeout=120)
    if os.path.exists(out_pdf):
        print("PDF generado con éxito:", out_pdf, os.path.getsize(out_pdf), "bytes")
    else:
        print("Aviso: el navegador finalizó pero no se creó el PDF. Salida:", res.stderr.decode(errors="ignore"))
else:
    print("Aviso: No se encontró Chrome o Edge para generar el PDF automáticamente.")
