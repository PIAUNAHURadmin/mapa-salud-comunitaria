# Panel de Salud Comunitaria · Región Sanitaria VII

Panel interactivo **georreferenciado** y accesible de servicios públicos de salud del conurbano bonaerense. Proyecto interdisciplinario entre las carreras de **Licenciatura en Salud Comunitaria** y **Licenciatura en Inteligencia Artificial** de la **Universidad Nacional de Hurlingham (UNAHUR)**.

> ⚠️ **Versión DEMO** — elaborada a partir del relevamiento territorial de los estudiantes.  
> La información no sustituye las fuentes ni carteleras oficiales del Ministerio de Salud de la Provincia de Buenos Aires.

🌐 **Sitio Web Publicado (Hosting en GitHub Pages)**:  
👉 **[https://piaunahuradmin.github.io/mapa-salud-comunitaria/](https://piaunahuradmin.github.io/mapa-salud-comunitaria/)**

---

## 🎯 Qué es y Objetivos

El objetivo principal es reducir la **barrera de accesibilidad informacional**: permitir que cualquier vecino o equipo de salud sepa qué servicio público existe, dónde se ubica, qué prestaciones brinda, cómo llegar en transporte público y a qué nivel de atención corresponde.

El panel cubre los **10 municipios** que integran la **Región Sanitaria VII** de la Provincia de Buenos Aires:
*Hurlingham, Ituzaingó, Morón, Merlo, Moreno, Tres de Febrero, General Rodríguez, General Las Heras, Marcos Paz y Luján*.

---

## 🚀 Últimos Cambios y Actualizaciones del Proyecto

El proyecto ha incorporado importantes mejoras arquitectónicas, de movilidad y de interfaz de usuario:

### 1. 🗺️ Actualización de API y Servicios del Mapa

* **Migración a Esri ArcGIS World_Street_Map**:
  * Se adoptó la capa de teselas **Esri ArcGIS World_Street_Map** (`https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}`).
  * **Ventajas operativas**:
    * **Sin restricciones ni bloqueos HTTP 403**: funciona de forma transparente tanto en la web pública (*GitHub Pages*) como en entornos locales (`file:///` o `localhost`), sin requerir registro de API keys ni tokens con cuotas de uso.
    * **Estilo claro institucional**: calles, avenidas principales, vías de ferrocarril y límites administrativos del Gran Buenos Aires en español con alto contraste y legibilidad óptima para mapas de salud.
* **Marcadores Institucionales SVG Vectoriales**:
  * Identificación clara en el mapa mediante pines dinámicos (`L.divIcon`):
    * 🏠 **Verde UNAHUR** (`#347516`): Centros de Atención Primaria de la Salud (CAPS).
    * 🏥 **Cyan Salud** (`#08a2c4`): Hospitales de Segundo y Tercer Nivel.
    * 📍 **Punto de Usuario**: Marcador interactivo con animación de pulso concéntrico.
* **Geolocalización Híbrida**:
  * Integración con la **HTML5 Geolocation API** (`navigator.geolocation`) con alta precisión (`enableHighAccuracy: true`).
  * Soporte para selección manual directa haciendo clic en cualquier punto del mapa, o fallback al centroide municipal de referencia (Hurlingham).
* **Ruteo Vial y Transporte Público (Delegación Inteligente)**:
  * Se sustituyó el trazado vial simulado / ficticio por una **delegación oficial y exacta** a través de deep links parametrizados:
    * **Google Maps Transit API / URL Scheme**: `https://www.google.com/maps/dir/?api=1&origin={lat},{lon}&destination={lat},{lon}&travelmode=transit` (horarios en vivo, frecuencias y paradas de colectivos y trenes).
    * **Moovit Web API / Deep Link**: `https://moovitapp.com/index/es/transporte_p%C3%Bublico-site_search?orig_lat={lat}&orig_lng={lon}&dest_lat={lat}&dest_lng={lon}` (itinerarios alternativos y líneas urbanas).
  * En el mapa se dibuja una **línea guía discontinua (Polyline)** entre Punto A (Origen) y Punto B (Destino), ajustando automáticamente el zoom (`map.fitBounds`) con margen para observar el trayecto completo de un vistazo.

---

### 2. ⚡ Funcionamiento y Arquitectura de la Aplicación

La aplicación funciona como una **Single Page Application (SPA)** modular, reactiva y ligera, gestionada mediante un estado centralizado (`state`) sin recargas de página:

* **5 Vistas Principales**:
  1. **Inicio (`view-inicio`)**:
     * Portada hero institucional con el titular: *"¿QUÉ NECESITÁS BUSCAR HOY?"*.
     * Campo de búsqueda libre con botón de borrado rápido.
     * Acceso rápido a geolocalización ("Usar mi ubicación") y navegación directa al mapa ("Ver mapa completo").
     * Grilla de 8 categorías temáticas prioritarias (CAPS, Hospitales, Vacunación, Salud mental, Odontología, Rehabilitación, Oftalmología, Otros) que aplican el filtro y transfieren al mapa de inmediato.
     * Banner de métricas institucionales (313 efectores, 10 municipios, 13 campos de atención, acceso público y gratuito).
  2. **Mapa y Resultados (`view-mapa`)**:
     * Diseño dividido (*split layout*): columna lateral izquierda (escritorio) con buscador integrado, carrusel de chips de categorías con desplazamiento horizontal, selector de municipios y contador de resultados.
     * Listado con scroll memoizado (preserva la posición al ir y volver de la ficha del establecimiento).
     * En dispositivos móviles se activa un **Bottom Sheet (Panel inferior deslizable)** que permite expandir y contraer la lista sobre el mapa con un gesto o toque.
  3. **Ficha de Establecimiento (`view-ficha`)**:
     * Ficha individual exhaustiva del centro seleccionado.
     * Encabezado con imagen institucional o placeholder neutral normado (proporciones 16:9 en móvil y 3:1 en escritorio).
     * Datos esenciales: dirección exacta, distancia calculada respecto a la ubicación del usuario, enlace telefónico directo (`tel:`), régimen de atención y badges de nivel.
     * Listado de prestaciones y servicios confirmados con tildes verdes.
     * Indicadores de accesibilidad física (♿ Entrada accesible, 🅿️ Estacionamiento, 🩺 Consultorios equipados).
     * Acciones principales: botón directo **"Cómo llegar"** y botón interactivo **"Guardar en favoritos"**.
  4. **Mis Favoritos (`view-favoritos`)**:
     * Almacenamiento persistente en el navegador mediante `localStorage` (`unahur_salud_favoritos`).
     * Sincronización automática de contadores en los badges del header y de la barra de navegación móvil.
     * Vista dedicada con listado de centros guardados y acceso inmediato a sus fichas.
  5. **Sobre el Proyecto (`view-info`)**:
     * Marco académico interdisciplinario UNAHUR.
     * Glosario conceptual de niveles de atención (Primer Nivel - CAPS, Segundo Nivel - Hospitales generales, Tercer Nivel - Hospitales de alta complejidad).
     * Cobertura geográfica de los 10 municipios de la Región Sanitaria VII.
* **Cálculo de Distancias en Tiempo Real**:
  * Utiliza la fórmula geodésica de **Haversine** para calcular la distancia en kilómetros o metros entre la posición del usuario y cada efector.
  * Reordena automáticamente los resultados de menor a mayor distancia tan pronto se detecta la ubicación.
* **Sistema de Notificaciones (Toasts)**:
  * Mensajes contextuales accesibles (`role="status"`, `aria-live="polite"`) que emergen en la parte inferior al guardar o eliminar centros.
  * Botón interactivo de **"Deshacer"** al quitar un centro de favoritos.

---

### 3. 🎨 Rediseños de UX/UI (Manual de Estilo Institucional UNAHUR)

El panel fue rediseñado de forma integral a partir de las especificaciones del **Manual de Estilo e Interfaz de Usuario** ([`docs/UXUI.pdf`](./docs/UXUI.pdf)):

* **Identidad Visual y Tokens Institucionales**:
  * **Verde UNAHUR** (`--action: #347516`, `--brand-green: #5aa123`, `--selected: #e5f1de`): protagonista en botones de acción, tildes y selección activa.
  * **Cyan Salud** (`--brand-cyan: #08a2c4`, `--focus: #00677d`): acento institucional para hospitales, trazas en el mapa y estados de foco.
  * **Superficies Claras y Luminosas** (`--surface: #ffffff`, `--surface-soft: #f2f7f8`, `--line: #d7e1e4`): interfaz limpia, diáfana y con alto contraste, dejando atrás los temas oscuros previos.
  * **Tipografía Inter**: implementada mediante Google Fonts con escala tipográfica legible y pesos diferenciados (400 a 800).
* **Popup y Modal "Cómo llegar" según el Mockup Oficial**:
  * Ventana modal centrada y panel flotante en la esquina superior del mapa.
  * Tarjetas de **Punto A (Origen)** y **Punto B (Destino)** conectadas por una flecha direccional, indicando distancia estimada y dirección exacta.
  * Botones institucionales con logos vectoriales originales (SVG) de **Google Maps** y **Moovit**, con enlace directo para consultar frecuencias y paradas en vivo.
* **Diseño Mobile-First y Responsive**:
  * **Bottom Navigation Bar**: Barra de navegación inferior fija para móviles con 4 accesos directos (Inicio, Mapa, Buscar, Favoritos con badge numérico).
  * **Drawer Menú Lateral**: Panel deslizante accesible desde el botón hamburguesa con navegación completa y logo institucional.
  * **Bottom Sheet Deslizable**: Manejo fluido de listas de resultados en smartphones sin obstaculizar la visualización del mapa.
* **Accesibilidad Web (a11y)**:
  * Foco visible reforzado (`outline: 3px solid var(--focus)`) para navegación por teclado.
  * Áreas táctiles amplias (mínimo 44px de alto) cumpliendo normativas WCAG 2.1 AA.
  * Textos descriptivos ocultos para lectores de pantalla mediante la clase `.sr-only`.

---

## 💻 Cómo usarlo

1. **Acceso online (GitHub Pages)**:
   Ingresá desde cualquier navegador (computadora, tablet o smartphone) a:
   👉 **[https://piaunahuradmin.github.io/mapa-salud-comunitaria/](https://piaunahuradmin.github.io/mapa-salud-comunitaria/)**

2. **Abrir el panel localmente (sin conexión)**:
   Hacé doble clic en `index.html`. Funciona de forma 100% autónoma ya que los datos están embebidos como scripts JavaScript (`.js`).

   > *Alternativa con servidor local*: desde la carpeta del proyecto ejecutá `python -m http.server 8000` y navegá a `http://localhost:8000`.

3. **Búsqueda y Filtros**:
   - Escribí texto libre (ej. *"pediatría"*, *"mamografía"*, *"odontología"* o el nombre del centro).
   - Filtrá por chips de categoría rápida o seleccioná un municipio específico de la Región Sanitaria VII.

4. **Tu Ubicación y Ordenamiento**:
   - Presioná **"Usar mi ubicación"** o el botón GPS 📍 para activar la geolocalización.
   - También podés hacer clic directamente sobre el mapa para fijar un punto de referencia.
   - Los efectores se ordenarán automáticamente desde el más cercano al más lejano con la distancia exacta.

5. **Cómo llegar y Favoritos**:
   - En cualquier efector, presioná **"Cómo llegar"** para abrir el modal institucional, visualizar la conexión de puntos en el mapa y abrir el itinerario en Google Maps o Moovit.
   - Marcá el corazón para guardar el establecimiento en **Mis Favoritos** y consultarlo rápidamente cuando lo necesites.

---

## 📁 Estructura del Proyecto

```
panel-salud-comunitaria/
├── index.html                      → Aplicación SPA principal (vistas, modales y layouts)
├── assets/
│   ├── css/
│   │   ├── styles.css              → Sistema de diseño UX/UI institucional (tokens, responsive, tema claro)
│   │   └── output.css              → Estilos complementarios compilados
│   ├── js/
│   │   └── app.js                  → Lógica de la SPA, Leaflet, Haversine, deep links y favoritos
│   └── img/
│       ├── logo-unahur.png         → Logo oficial UNAHUR (versión institucional)
│       └── logo-unahur-blanco.png  → Variante blanca del logo
├── data/                           → Base de datos normalizada y georreferenciada (JSON + JS embebido)
│   ├── efectores.json/.js          → 313 establecimientos públicos de salud y nutrición
│   ├── municipios.json/.js         → 10 municipios de la RS VII con coordenadas de referencia
│   ├── taxonomia.json/.js          → 13 categorías y 45 subcategorías relevadas
│   ├── colectivos.json/.js         → Líneas comunales e interurbanas de la RS VII
│   └── resumen.json/.js            → Métricas agregadas de la base de datos
├── procesamiento/                  → Scripts en Python para extracción, normalización y documentos
│   ├── build_data.py               → Extracción desde planillas Excel + geocodificación
│   ├── export_js.py                → Exportador de datos estáticos a variables globales JS
│   ├── generar_pdf.py              → Generador de documentación HTML y PDF para presentaciones
│   └── geocode_cache.json          → Caché de consultas de geocodificación (Nominatim)
└── docs/                           → Documentación integral del proyecto
    ├── UXUI.pdf                    → Manual de Estilo e Interfaz de Usuario oficial (guía de diseño)
    ├── DICCIONARIO_DATOS.md        → Descripción campo por campo de la base de datos
    ├── PROCESO_DATOS.md            → Procedimiento de normalización, georreferenciación y ruteo
    ├── FUENTES.md                  → Registro de fuentes oficiales y planillas del relevamiento
    ├── documentacion.html          → Documento técnico para lectura o impresión
    └── Documentacion_Panel_Salud_Comunitaria.pdf → Documento resumen compilado en PDF
```

---

## 📚 Documentación Técnica

* [`docs/UXUI.pdf`](./docs/UXUI.pdf) — Manual de diseño de interfaz de usuario y componentes institucionales.
* [`docs/DICCIONARIO_DATOS.md`](./docs/DICCIONARIO_DATOS.md) — Estructura y tipos de datos de efectores, municipios y transporte.
* [`docs/PROCESO_DATOS.md`](./docs/PROCESO_DATOS.md) — Procedimiento de extracción, depuración y estrategias de georreferenciación.
* [`docs/FUENTES.md`](./docs/FUENTES.md) — Fuentes institucionales del Ministerio de Salud provincial y repositorio de enlaces.
* [`docs/Documentacion_Panel_Salud_Comunitaria.pdf`](./docs/Documentacion_Panel_Salud_Comunitaria.pdf) — Documentación técnica oficial en formato PDF.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnología / Herramienta | Función |
|------|--------------------------|---------|
| **Hosting** | [GitHub Pages](https://piaunahuradmin.github.io/mapa-salud-comunitaria/) | Despliegue estático continuo, HTTPS y disponibilidad global sin costo |
| **Arquitectura** | Vanilla HTML5 / JavaScript (SPA) | Navegación reactiva entre 5 vistas sin dependencias de frameworks ni build steps obligatorios |
| **Diseño y Estilos** | CSS3 Nativo con Custom Properties | Sistema de diseño institucional basado en [`docs/UXUI.pdf`](./docs/UXUI.pdf), tipografía Inter y diseño Mobile-First |
| **Cartografía** | [Leaflet 1.9.4](https://leafletjs.com/) | Motor de mapa interactivo, manejo de capas, marcadores SVG y encuadres |
| **Teselas del Mapa** | Esri ArcGIS `World_Street_Map` | Mapa base claro de calles en español, libre de errores 403 y con soporte offline/online |
| **Geolocalización** | HTML5 Geolocation API | Obtención de coordenadas del usuario en tiempo real con alta precisión |
| **Cálculo Geodésico** | Algoritmo de Haversine (JS) | Distancia en línea recta y ordenamiento dinámico de efectores |
| **Ruteo y Tránsito** | Deep Links a Google Maps y Moovit | Consulta de horarios, frecuencias y líneas de colectivos en tiempo real con coordenadas exactas |
| **Persistencia** | Web Storage API (`localStorage`) | Guardado de establecimientos en Mis Favoritos en el navegador del cliente |
| **Geocodificación** | Nominatim / OpenStreetMap | Procesamiento inicial de direcciones con caché persistente |
| **ETL y Scripts** | Python 3 (openpyxl, urllib, json) | Normalización de datos tabulares y compilación de documentación PDF con navegador headless |
