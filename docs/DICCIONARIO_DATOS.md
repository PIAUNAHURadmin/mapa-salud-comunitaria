# Diccionario de datos

Los datos finales se encuentran en `data/` en dos formatos equivalentes:
`.json` (para procesos) y `.js` (para el navegador, asignan `window.EFECTORES`,
`window.MUNICIPIOS`, `window.TAXONOMIA` y `window.RESUMEN`).

---

## `efectores.json` — efectores de salud

Lista de **313** efectores (centros de salud, hospitales y consultorios).
Cada elemento es un objeto con estos campos:

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `nombre` | string | Nombre del establecimiento | `"CENTRO DE SALUD DR. RAMON CARRILLO"` |
| `domicilio` | string | Domicilio declarado (tal como figura en la fuente) | `"MANUELA PEDRAZA 750 - HURLINGHAM (1686)"` |
| `telefono` | string | Teléfono de contacto (`-` si no figura) | `"(11) 44599022"` |
| `sitio_web` | string | Sitio web (`-` si no figura) | `"-"` |
| `partido` | string | Municipio (normalizado) | `"Hurlingham"` |
| `categoria` | string | Categoría de la taxonomía | `"EFECTORES DE SALUD PÚBLICA"` |
| `subcategoria` | string | Subcategoría / disciplina / nivel | `"Primer Nivel"` |
| `nivel` | string \| null | Nivel de atención (solo efectores de salud) | `"Primer Nivel"`, `"Segundo Nivel"`, `"Tercer Nivel"`, `null` |
| `lat` | number \| null | Latitud (WGS84) | `-34.5933` |
| `lon` | number \| null | Longitud (WGS84) | `-58.6378` |
| `geo_origen` | string | Método de georreferenciación | `"domicilio"`, `"centroide_municipio"`, `"sin_geo"` |

### Categorías presentes (2 con datos tabulares)

| Categoría | Subcategorías | Registros |
|-----------|---------------|-----------|
| `EFECTORES DE SALUD PÚBLICA` | Primer Nivel / Segundo Nivel / Tercer Nivel | 229 |
| `NUTRICIÓN Y ALIMENTACIÓN` | Consultorios de nutrición | 84 |

> Las demás categorías de la taxonomía (salud sexual, oncología, salud mental,
> etc.) existen en la taxonomía y en los PDF provinciales, pero sus efectores aún
> no se desagregaron a nivel municipal en el relevamiento tabular.

---

## `municipios.json` — municipios de la Región Sanitaria VII

10 municipios, cada uno con:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `nombre` | string | Nombre normalizado |
| `lat` / `lon` | number | Coordenadas del centro del municipio (referencia) |
| `display_name` | string | Nombre completo devuelto por Nominatim |

Municipios incluidos: **Hurlingham, Ituzaingó, Morón, Merlo, Moreno, Tres de
Febrero, General Rodríguez, General Las Heras, Marcos Paz y Luján**.

---

## `taxonomia.json` — taxonomía de servicios

Categorías y subcategorías obtenidas del repositorio de enlaces del relevamiento.
Cada elemento:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `categoria` | string | Categoría de atención |
| `subcategorias` | array | Lista de `{ nombre, municipios }` |

Incluye 13 categorías y 45 subcategorías (ver el listado completo en la sección 4
del documento de proyecto).

---

## `resumen.json` — métricas

| Campo | Descripción |
|-------|-------------|
| `total_efectores` | Total de efectores (313) |
| `total_municipios` | Total de municipios (10) |
| `por_municipio` | Conteo de efectores por municipio |
| `por_categoria` | Conteo por categoría |
| `por_nivel` | Conteo por nivel de atención |
| `categorias` | Cantidad de categorías de la taxonomía |

---

## `colectivos.json` — base de datos de transporte público

Mapeo de líneas de colectivos por municipio de la Región Sanitaria VII y matriz de conexiones interurbanas directas entre partidos. Se exporta como variable global `window.COLECTIVOS` en `colectivos.js`:

| Campo principal | Tipo | Descripción | Ejemplo |
|-----------------|------|-------------|---------|
| `lineas_por_partido` | object | Diccionario donde cada clave es un municipio normalizado de la RS VII y su valor es un array de líneas que operan en él. | Ver detalle abajo |
| `conexiones_interurbanas` | array | Lista de conexiones directas entre pares de municipios contiguos con las líneas que efectúan el cruce directo. | Ver detalle abajo |

### Estructura de elementos en `lineas_por_partido[municipio]`

Cada línea dentro del array municipal contiene:

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `linea` | string | Número identificador de la línea | `"462"`, `"163"`, `"338"` |
| `ramales` | string | Recorrido / cabeceras principales del ramal | `"Hurlingham - Villa Tesei"`, `"Morón - San Isidro / La Plata"` |
| `tipo` | string | Categoría de la línea | `"Local"` (comunal), `"Interurbano"`, `"Interurbano / CABA"`, `"Troncal"` |

### Estructura de elementos en `conexiones_interurbanas`

| Campo | Tipo | Descripción | Ejemplo |
|-------|------|-------------|---------|
| `origen` | string | Nombre del municipio de partida | `"Hurlingham"` |
| `destino` | string | Nombre del municipio de llegada | `"Morón"` |
| `lineas` | array | Lista de números de línea directas entre ambos | `["244", "338", "390", "464"]` |

---

## Campo `geo_origen` (transparencia de la georreferenciación)

- **`domicilio`** — la dirección se resolvió con OpenStreetMap/Nominatim a una
  coordenada puntual.
- **`centroide_municipio`** — la dirección no se pudo resolver; el punto se ubicó
  en el centro del municipio (con un pequeño desplazamiento determinístico para
  que no se superpongan). **La posición es aproximada.**
- **`sin_geo`** — sin coordenadas disponibles (no se muestra en el mapa).

En el panel, todos los puntos con origen `centroide_municipio` deben interpretarse
como una **referencia municipal**, no como la ubicación exacta del establecimiento.
