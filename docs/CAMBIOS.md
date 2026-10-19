# Registro de cambios — datos

Cambios en la parte de **datos** (`procesamiento/` y `data/`). Cuando se toca el
frontend se aclara explícitamente en la entrada.

---

## 2026-10-13 · Integración con la interfaz nueva ("uxui cambiada")

- Los commits de datos se reubicaron encima de `main` (interfaz nueva). **La interfaz no se tocó**:
  `app.js` e `index.html` quedan exactamente como en `main`.
- Los cambios de `app.js` descriptos en los pasos 1 y 2 (filtro por `servicios`, búsqueda sin tildes)
  eran para la interfaz anterior y **ya no aplican**.
- Probado: la interfaz nueva carga los 242 establecimientos y los filtros funcionan sin errores.
- Pendiente para frontend: la interfaz nueva no lee el campo `servicios` (ver notas al equipo).

---

## 2026-10-13 · Paso 3b: establecimientos de `RawData` que faltaban

Se revisó **todo `RawData`** buscando establecimientos de la RS VII que no estuvieran en el panel.

- **Listados PDF** (CAPS provincial, CAPS Hurlingham, Hospitales, salud sexual, oncología): sus
  355 filas de la RS VII coinciden con establecimientos ya cargados. **No faltaba ninguno.**
- **Fuera de los listados** faltaban 2, que se agregaron desde `procesamiento/establecimientos_adicionales.csv`
  (transcripción manual, con la fuente de cada uno). El script solo los agrega si no existen ya:

| Establecimiento | Fuente | Servicio |
|---|---|---|
| UPA 20 (General Rodríguez) | `R.S VII .jpg` y `hospitales-pciales-y-nac.pdf` | Urgencias y guardia › Guardia 24 hs |
| Junta Evaluadora CUD (Av. Vergara 3020, Hurlingham) | `CUD/CUD2.jpg` | Discapacidad › Certificado Único de Discapacidad (CUD) |

- ⚠️ **UPA 20**: la fuente no trae domicilio → punto aproximado en el centro de General Rodríguez.
- **No se agregó** el Servicio Penitenciario Federal Complejo II (Marcos Paz): es el hospital de la
  cárcel, no atiende al público.
- Total: **242 establecimientos**. Guardia 24 hs: 4 · CUD: 1.

### Control de repetidos
Se compararon todos los pares del mismo partido (nombre, palabras clave y dirección). Hay 9 pares con
dirección parecida, pero son **establecimientos distintos** registrados por separado por la Provincia,
y se dejan así. Por ejemplo, el Hospital Odontológico y el Oftalmológico "Norberto Di Próspero" en
Valentín Gómez 4545, o el CAPS y el Centro Integral de la Mujer en Haití y Turquía (Ituzaingó).
En el mapa quedan uno sobre otro.

---

## 2026-10-12 · Paso 3: integración con el repo + resto de fuentes de `RawData`

Se trabajó sobre la versión del repositorio (la que incluye "Cómo llegar en colectivo") y se
integraron los pasos 1 y 2. Solo se usaron archivos de `RawData`. **No se agregó ningún
establecimiento nuevo** (siguen siendo 240).

### 1. Nuevas fuentes incorporadas (`extraer_pdfs.py`)
| Fuente en `RawData` | Servicio asignado | Establecimientos RS VII |
|---|---|---|
| `Oncología/Establecimiento IPC.pdf` (Instituto Provincial del Cáncer: banco de drogas, cuidados paliativos, radioterapia) | Enf. crónicas › Oncología (derivación) | 10 (todos ya estaban) |
| `Programa Qunita/HURLINGHAM.pdf` | Poblaciones específicas › Primera infancia | 11 (todos ya estaban) |
| `Hosp. Provinciales y Nacionales/R.S VII .jpg` (UPA 24 hs, transcripción manual en `procesamiento/transcripcion_rs7_upa24.csv`) | Urgencias y guardia › Guardia 24 hs | 3 (UPA 9, 12 y 16) |

- **UPA 20 (General Rodríguez)**: ver Paso 3b (se agregó).

### 2. Tres de Febrero: 1er nivel recuperado
- El Excel de 1er nivel de Tres de Febrero es copia del de Morón. Se reemplazó con los **11 CAPS de
  Tres de Febrero** del listado provincial `RawData/CAPS/Listado_establecimientos_*.pdf`.
- Los 11 ya estaban en el panel como consultorios de nutrición pero **sin nivel**. Ahora son
  "Primer Nivel". No se agregaron puntos.

### 3. Coincidencias más flexibles (y auditables)
- Además del nombre exacto, `build_data.py` acepta: nombre parecido, mismas palabras clave del nombre
  ("Centro de Salud 2 de Junio" = "UNIDAD SANITARIA 2 DE JUNIO DE HURLINGHAM") o misma calle y número
  ("Barrio Mitre, Palermo 555" = "UNIDAD SANITARIA BARTOLOME MITRE"), solo si hay un único candidato.
- Toda coincidencia que no fue por nombre exacto queda listada en
  `procesamiento/servicios_coincidencias_a_revisar.json` (hoy 10) para que Salud Comunitaria la valide.
- Al unificar registros, si un dato está vacío (teléfono, web) se completa con el de los otros registros.

### 4. Detalles
- El lector de PDF ahora acepta código postal vacío "()" (había 1 registro de Tigre que se perdía).

### Qué muestra hoy el panel
VIH/ITS 87 · Nutrición 84 · Oncología 22 · Anticoncepción/ILE-IVE 16 · Primera infancia 15 ·
Ginecología y obstetricia 6 · Guardia 24 hs 3.

### Archivos de `RawData` que NO aportan servicios (y por qué)
- `CUD/*.jpg`: capturas del trámite del CUD. La única dirección es la Junta Evaluadora de Hurlingham
  (Av. Vergara 3020): ver Paso 3b (se agregó).
- `Oncología/ Hospitales.pdf`: listado general de hospitales (sin servicio específico).
- `hospitales-pciales-y-nac.pdf`: solo indica dependencia provincial/nacional.
- **No hay datos de ESI** en `RawData`.

### Cómo regenerar
```
cd procesamiento
python extraer_pdfs.py           # PDF + transcripción -> servicios_pdf.json, caps_tres_de_febrero.json
python build_data.py --geocode   # Excel + servicios -> data/*.json
python export_js.py              # data/*.js para el panel (incluye colectivos.js)
```
`build_data.py` busca `RawData` al lado de la carpeta del repo (`../RawData`).

---

## 2026-09-29 · Paso 2: cada establecimiento en sus categorías

Respaldo del estado anterior: `../_respaldo/2026-09-29_antes-paso2/`.
Se trabajó **solo con los datos entregados** (`RawData`). **No se agregó ningún establecimiento.**

### 1. Un registro por establecimiento ✅
- 73 CAPS figuraban dos veces (como "Primer Nivel" y como "Consultorio de nutrición"); su domicilio
  difería solo por espacios dobles. Ahora hay **un registro por establecimiento** con un campo nuevo
  `servicios` (lista de `{categoria, subcategoria}`).
- Resultado: 313 registros → **240 establecimientos únicos**. Ninguno perdió su ubicación exacta.

### 2. Servicios tomados de los PDF de `RawData` ✅
- Nuevo script `procesamiento/extraer_pdfs.py`: lee los listados PDF de la Provincia, se queda con
  los 10 municipios de la RS VII y genera `procesamiento/servicios_pdf.json`.
- Los conteos leídos coinciden con los "Resultados obtenidos" de cada PDF (salvo 1 de 399 en testeo VIH).
- Los 160 registros de la RS VII coincidieron con establecimientos que ya estaban (159 por nombre
  exacto, 1 por nombre casi igual). Lo que no coincida queda en `servicios_sin_match.json` (hoy vacío).

| PDF | Servicio asignado (taxonomía) | Establecimientos RS VII |
|---|---|---|
| Testeo rápido VIH/sífilis, PEP, atención VIH (adultos, niñxs, gestantes) | Enfermedades transmisibles › VIH/ITS | 87 |
| Acceso a aborto | Salud sexual… › Anticoncepción / ILE-IVE | 16 |
| Mamografía, Ecografías mamarias | Enf. crónicas › Oncología (derivación) | 18 |
| Ecografía obstétrica | Atención clínica › Ginecología y obstetricia | 6 |
| Donación de leche | Poblaciones específicas › Primera infancia | 4 |

⚠️ **A validar por Salud Comunitaria:** el mapeo PDF → categoría está en `PDF_SERVICIO`
(`extraer_pdfs.py`). En especial "Donación de leche → Primera infancia".

No se usaron: `CAPS/*.pdf` (ya cubiertos por los Excel), `Oncología/ Hospitales.pdf` (listado general
de hospitales), `Establecimiento IPC.pdf`, `hospitales-pciales-y-nac.pdf` y `Programa Qunita`
(formatos distintos, quedan pendientes).

### 3. Niveles de atención fuera del menú ✅
- "Efectores de salud pública › Primer/Segundo/Tercer Nivel" se quitó del menú de filtros: el nivel
  se distingue por **color en el mapa**. El dato `nivel` sigue en cada establecimiento.

### 4. Filtro por lista de servicios (⚠️ frontend: `assets/js/app.js`, acordado con Lucas)
- El filtro ahora busca en `servicios` (función `tieneServicio`). La búsqueda por texto también mira
  los nombres de los servicios. Menús y diseño sin cambios.

### Qué muestra hoy el panel
Ginecología y obstetricia 6 · Anticoncepción/ILE-IVE 16 · VIH/ITS 87 · Oncología 18 ·
Nutrición 84 · Primera infancia 4. **Dermatología, pediatría, salud mental, etc. siguen en 0**:
los datos entregados no dicen qué especialidades atiende cada establecimiento.

### Cómo regenerar (actualizado)
```
cd procesamiento
python extraer_pdfs.py           # PDF -> servicios_pdf.json (requiere pdftotext)
python build_data.py --geocode   # Excel + servicios -> data/*.json
python export_js.py              # data/*.js para el panel
```

---

## 2026-09-29 · Paso 1: arreglar lo que estaba roto

Respaldo del estado anterior: `../_respaldo/2026-09-29_antes-paso1/`
(copia de `data/` y `procesamiento/` antes de estos cambios).

### 1. Filtro por categoría devolvía 0 resultados ✅
- **Problema:** `taxonomia.json` usaba `EFECTORES DE SALUD PUBLICA` / `NUTRICION Y ALIMENTACION`
  (sin tildes) y `PRIMER NIVEL`, mientras que `efectores.json` usa `EFECTORES DE SALUD PÚBLICA` /
  `NUTRICIÓN Y ALIMENTACIÓN` y `Primer Nivel`. El panel compara texto exacto → nunca coincidía.
- **Solución:** `build_data.py` normaliza la taxonomía a los mismos nombres que los efectores
  (`CATEGORIA_CANON`, `SUBCATEGORIA_CANON`). También se limpió la subcategoría
  "TERCER NIVEL entrar a poblaciones .org y van a encontar" → `Tercer Nivel`.
- **Verificación:** todas las categorías/subcategorías de `efectores.json` existen en `taxonomia.json`.

### 2. Centro de Tres de Febrero ubicado en Palermo (CABA) ✅
- **Problema:** al geocodificar "Tres de Febrero, Buenos Aires" Nominatim devolvía la Av. 3 de
  Febrero en Palermo. Todos los efectores de Tres de Febrero sin dirección resuelta se dibujaban en CABA.
- **Solución:** coordenada fijada a mano (Caseros, cabecera del partido) en `MUNICIPIO_COORD_MANUAL`.

### 3. Coordenadas fuera de la Región Sanitaria VII ✅
- **Problema:** el "Centro de Medicina Preventiva y Social Eva Perón" (Luján) quedó geocodificado
  cerca de Tandil (lat -36.77).
- **Solución:** toda coordenada fuera de la caja de la RS VII (`BBOX_RS7`) se descarta y el punto
  pasa a `centroide_municipio`. El script avisa en consola cada vez que descarta una.

### 4. Excel de Tres de Febrero (primer nivel) es una copia del de Morón ⚠️ pendiente
- `RawData/.../PRIMER NIVEL.../Listado_establecimientos_Tres_De_Febrero.xlsx` es idéntico al de Morón
  (la cabecera dice `Partido: MORON`).
- **Solución parcial:** el script ahora detecta cuando el partido de la cabecera no coincide con el
  nombre del archivo, lo omite y avisa.
- **Falta:** volver a descargar el listado de CAPS de Tres de Febrero desde
  https://sistemas.ms.gba.gov.ar/redatencion/ y reemplazar el archivo. Hasta entonces Tres de Febrero
  no tiene efectores de primer nivel en el panel.

### 5. El script no corría ✅
- Buscaba la carpeta `drive-download-20260929T120752Z-1-001`, que ahora se llama `RawData`.
  Ahora usa `RawData` (y acepta el nombre viejo si existe).
- Lectura/escritura de JSON forzada a UTF-8 (en Windows podía romper los acentos).
- Los errores de red de la geocodificación ya no se guardan en la caché (antes quedaban "pegados").

### Impacto en los datos
- Total de efectores: **313** (sin cambios).
- Registros modificados: **5** (solo coordenadas: 2 de Luján, 3 de Tres de Febrero).
- Puntos fuera de la RS VII: **5 → 0**.
- Georreferenciados por domicilio: 130 → 128 (los 2 de Luján eran incorrectos).

### 6. Filtros del panel (⚠️ cambio en frontend: `assets/js/app.js`, acordado con Lucas)
Respaldo del `app.js` anterior: `../_respaldo/2026-09-29_antes-paso1/assets_js/app.js`.
- Los menús de categoría y servicio quedan **igual que antes** (todas las opciones elegibles).
  Se probó marcar las categorías vacías como "sin datos aún", pero se revirtió: los filtros son por
  necesidad (dermatología, cardiología, etc.) y el nivel de atención se distingue por color en el mapa.
- **Cambiar de categoría dejaba el filtro en 0:** el servicio elegido antes (p. ej. "Primer Nivel")
  seguía aplicándose aunque el menú mostrara "Todos los servicios". Ahora se resetea.
  Además se evitó que se acumulara un listener nuevo en cada cambio.
- **La búsqueda distinguía tildes:** "nutricion" no encontraba "NUTRICIÓN". Ahora se ignoran tildes
  y mayúsculas.
- **Probado en navegador:** cambio de categoría sin quedar en 0, búsqueda "nutricion" 84, sin errores en consola.

### Cómo regenerar
```
cd procesamiento
python build_data.py --geocode   # usa la caché, no vuelve a consultar lo ya resuelto
python export_js.py              # genera los data/*.js que usa el panel
```
