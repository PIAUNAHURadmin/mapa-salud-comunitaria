# Proceso de datos — qué se hizo con cada archivo

Los archivos originales están en la carpeta
`drive-download-20260929T120752Z-1-001/`. A continuación se detalla el tratamiento
dado a cada uno y el resultado.

## 1. Archivos Excel (`.xlsx`) → base de datos principal

### `DATOS VINCULADOS A LA TABLA/EFECTORES DE SALUD PUBLICA/**/Listado_establecimientos_*.xlsx` (22 archivos)

Listados de establecimientos por municipio y por nivel de atención (Primer, Segundo
y Tercer Nivel). Cada archivo tiene una cabecera con metadatos (partido, tipo de
establecimiento, resultados) y una tabla con columnas
`Establecimiento | Domicilio | Sitio web | Tel. Contacto`.

**Qué se hizo:**
1. Se extrajeron todas las filas de todas las hojas.
2. Se capturó el **partido** de la cabecera y el **nivel** de la carpeta de origen.
3. Se **normalizaron los nombres de municipio** (acentos, mayúsculas):
   `GENERAL RODRIGUEZ → General Rodríguez`, `MORON → Morón`, `ITUZAINGO → Ituzaingó`, etc.
4. Se **deduplicaron** registros por `(nombre, domicilio)`.
5. Se **georreferenció** cada domicilio con OpenStreetMap/Nominatim.

→ Resultado: **229 efectores** en `data/efectores.json`.

### `DATOS VINCULADOS A LA TABLA/NUTRICIÓN Y ALIMENTACIÓN/CONSULTORIOS DE NUTRICION/consultorios de nutricion *.xlsx` (10 archivos)

Listados de consultorios de nutrición por municipio (misma estructura, columna
`Especialidad: NUTRICIÓN`).

**Qué se hizo:** igual que arriba; se clasificó como
`categoria = NUTRICIÓN Y ALIMENTACIÓN`, `subcategoria = Consultorios de nutrición`.

→ Resultado: **84 efectores** en `data/efectores.json`.

### `REPOSITORIO DE ENLACES GEOREF.xlsx`

Índice de **enlaces** (a Google Sheets y a búsquedas del sistema `redatencion`) que
estructura el relevamiento en `CATEGORIA / SUBCATEGORIA / MUNICIPIO / ENLACE`.

**Qué se hizo:** se extrajo la taxonomía (categoría → subcategoría → municipios)
y se volcó a `data/taxonomia.json`. Los enlaces no se incorporaron al panel (son
referencias de trabajo del equipo).

→ Resultado: **13 categorías y 45 subcategorías** en `data/taxonomia.json`.

---

## 2. Archivos Word (`.docx`) → marco del proyecto

### `proyecto_panel_salud_comunitaria.docx`

Documento de fundamentación del proyecto. **No se procesó**; es material de
referencia (fundamentación, objetivos, componentes y listado de disciplinas).

### `Lineamiento.docx`

Lineamientos generales del proyecto (roles, alcance territorial, criterios de
visualización). **No se procesó**; es material de referencia.

---

## 3. Archivos PDF → fuentes provinciales (pendientes de desagregar)

Estos PDF contienen **listados provinciales** (toda la Provincia de Buenos Aires),
no filtrados a la Región Sanitaria VII. Se conservan como fuentes y no se
incorporaron a la base tabular del panel en esta versión:

| Archivo | Contenido | Observación |
|---------|-----------|-------------|
| `CAPS/Listado_establecimientos_1783203171444.pdf` | 1203 CAPS de toda la provincia | Ya cubierto por los `.xlsx` de CAPS de la RS VII |
| `CAPS/Hurlingham- Listado_establecimientos_.pdf` | 8 CAPS de Hurlingham | Subconjunto de lo ya procesado |
| `Hosp. Provinciales y Nacionales/hospitales-pciales-y-nac.pdf` | Hospitales provinciales y nacionales | Incluye los de la RS VII (Posadas, Bicentenario de Ituzaingó, etc.) |
| `Oncología/*.pdf` (4 archivos) | Mamografías, ecografías mamarias, IPC, hospitales oncológicos | Provincial, sin filtro RS VII |
| `Salud sexual y reproductiva/*.pdf` (8 archivos) | VIH/ITS, testeo, aborto, donación de leche, ecografías, etc. | Provincial, sin filtro RS VII |
| `Programa Qunita/HURLINGHAM.pdf` | CAPS de Hurlingham adheridos a Qunita | Subconjunto municipal |

**Qué se hizo:** se extrajo el texto para comprender su estructura y alcance. Se
detectó que son **listados a nivel provincial**; incorporarlos exige filtrar por los
10 municipios de la RS VII y cruzar con las direcciones ya georreferenciadas. Queda
como **próximo paso** del proyecto.

---

## 4. Imágenes CUD

### `CUD/*.jpg|*.png` (6 imágenes)

Capturas sobre el **Certificado Único de Discapacidad**. No son datos estructurados;
no se incorporaron al panel.

---

## 5. Geocodificación (detalle)

- Servicio: **Nominatim / OpenStreetMap** (gratuito, rate-limitado a ~1 petición/seg).
- Estrategia: se geocodificó el `domicilio + partido + "Buenos Aires, Argentina"`.
- **Fallback**: si la dirección no se resolvió, se asignó el **centro del municipio**
  con un desplazamiento determinístico pequeño (para evitar puntos superpuestos).
- Resultado: campo `geo_origen` distingue `domicilio` de `centroide_municipio`.
- Caché: `procesamiento/geocode_cache.json` guarda las respuestas para no repetir
  peticiones en futuras ejecuciones.

> ⚠️ Los puntos con origen `centroide_municipio` **no representan la ubicación
> exacta** del establecimiento. Ver leyenda del panel.

---

## 6. Módulo de transporte público (Colectivos) y ruteo

Para dar respuesta a la accesibilidad física a los efectores de salud, se diseñó una solución de movilidad precisa, resiliente y de cero mantenimiento de backend:

1. **Relevamiento y estructura de datos (`colectivos.json`)**:
   - Se compilaron las principales líneas comunales, provinciales e interurbanas que circulan en los 10 municipios de la Región Sanitaria VII.
   - Se discriminaron ramales y tipo de servicio (local comunal, interurbano, troncal).
   - Se construyó una **matriz de conexiones directas** entre municipios contiguos para resolver viajes interurbanos (ej. conexiones entre Hurlingham, Morón, Ituzaingó, Tres de Febrero, etc.).

2. **Pipeline de exportación (`export_js.py`)**:
   - El script `procesamiento/export_js.py` lee `data/colectivos.json` y genera automáticamente `data/colectivos.js` definiendo la variable global `window.COLECTIVOS`. Esto permite abrir el proyecto haciendo doble clic directamente en `index.html` sin requerir servidor web ni backend.

3. **Estrategia de ruteo y tránsito en tiempo real (Delegación oficial)**:
   - **Eliminación de trazados ficticios**: Para evitar desinformar a los usuarios con rutas automovilísticas aproximadas o líneas de colectivo simuladas (que no reflejaban paradas oficiales, sentidos de circulación ni frecuencias horarias reales), se eliminó la dependencia de cálculos ficticios vía OSRM y se implementó una integración profunda mediante **Deep Links parametrizados con coordenadas exactas**.
   - **Google Maps Transit API / URL Scheme**: Genera enlaces parametrizados en modo tránsito (`travelmode=transit`) pasando origen y destino exactos (`origin={lat},{lon}&destination={lat},{lon}`), permitiendo al usuario conocer qué colectivo tomar, paradas oficiales, horarios programados y demoras en vivo.
   - **Moovit Web API / Deep Link**: Genera enlaces directos a la plataforma de transporte metropolitano con coordenadas geográficas (`orig_lat={lat}&orig_lng={lon}&dest_lat={lat}&dest_lng={lon}`), ofreciendo alertas de servicio y opciones de combinación interurbana.
   - **Visualización en el mapa interactivo**: Al solicitar *"Cómo llegar"*, el mapa posiciona automáticamente el **Punto A (Origen)** y el **Punto B (Destino)**, traza una línea guía discontinua institucional (`L.polyline` celeste `#08a2c4`), ajusta dinámicamente el zoom (`map.fitBounds`) para encuadrar ambos extremos con padding, y abre el modal institucional de viaje.

4. **Despliegue y hosting continuo (GitHub Pages)**:
   - Dado que la solución está diseñada bajo una arquitectura 100% estática (sin requerir servidor backend ni bases de datos activas en runtime), el proyecto se publica directamente en la web a través de **GitHub Pages**:
   - 🌐 **URL pública:** [https://piaunahuradmin.github.io/mapa-salud-comunitaria/](https://piaunahuradmin.github.io/mapa-salud-comunitaria/)
   - Cualquier actualización en los scripts de procesamiento y archivos `.js` se refleja inmediatamente al sincronizar el repositorio.
