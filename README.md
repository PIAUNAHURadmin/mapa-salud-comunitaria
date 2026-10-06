# Panel de Salud Comunitaria · Región Sanitaria VII

Panel interactivo **georreferenciado** de servicios públicos de salud del conurbano
bonaerense. Proyecto interdisciplinario entre **Salud Comunitaria** e **Inteligencia
Artificial** de la Universidad Nacional de Hurlingham (UNAHUR).

> ⚠️ **Versión DEMO** — elaborada a partir del relevamiento de los estudiantes.
> La información no sustituye la consulta oficial de la Provincia de Buenos Aires.

🌐 **Sitio Web Publicado**: [https://piaunahuradmin.github.io/mapa-salud-comunitaria/](https://piaunahuradmin.github.io/mapa-salud-comunitaria/)

---

## Qué es

Permite a cualquier usuario ubicar y comprender la oferta pública de salud de la
**Región Sanitaria VII** (10 municipios), según su **ubicación** y su **necesidad
específica**. La idea central es reducir la barrera de **accesibilidad
informacional**: que la persona sepa que el servicio existe, dónde está y si
responde a su necesidad.

## Cómo usarlo

1. **Acceso online (Hosting en GitHub Pages)**:
   Ingresá directamente desde cualquier navegador y dispositivo a:
   👉 **[https://piaunahuradmin.github.io/mapa-salud-comunitaria/](https://piaunahuradmin.github.io/mapa-salud-comunitaria/)**

2. **Abrir el panel localmente (sin conexión)**:
   Hacé doble clic en `index.html`. Funciona sin servidor web
   (los datos están embebidos como archivos `.js`).

   > Alternativa local: desde esta carpeta corré `python3 -m http.server 8000` y abrí
   > `http://localhost:8000`.

3. **Filtrar**: elegí una *Categoría*, un *Servicio/disciplina* y/o un *Municipio*,
   o escribí texto libre (ej. "pediatría", "VIH", "mamografía").

4. **Indicar tu ubicación**:
   - botón 📍 (usa el GPS del dispositivo), o
   - escribir un domicilio en "Tu ubicación", o
   - hacer clic directamente sobre el mapa.

   Al marcar la ubicación, los resultados se **ordenan por distancia** y muestran
   los kilómetros a cada efector.

5. **Ver detalle y calcular cómo llegar en colectivo**:
   - Hacé clic sobre un punto del mapa o sobre un resultado de la lista para centrar el efector y consultar domicilio, teléfono y nivel de atención.
   - Hacé clic en **"🚌 Cómo llegar en colectivo"** (disponible tanto en el popup del mapa como en la tarjeta de resultados) para:
     - Trazar el **recorrido real sobre la red de calles y avenidas** en el mapa (vía OSRM).
     - Consultar la **guía paso a paso del viaje**: dónde tomar el colectivo, qué línea abordar, nodos de trasbordo interurbano (ej. estaciones ferroviarias), parada de descenso y caminata final.
     - Acceder a enlaces directos parametrizados a **Google Maps** y **Moovit** con origen y destino precargados.

## Estructura de la carpeta

```
panel-salud-comunitaria/
├── index.html              → página principal (panel)
├── assets/
│   ├── css/output.css      → estilos compilados (Tailwind + daisyUI, tema oscuro)
│   ├── js/app.js           → lógica del mapa (Leaflet), ruteo de colectivos y filtros
│   └── img/logo-unahur.png        → logo original (fondo claro)
│   └── img/logo-unahur-blanco.png → variante blanca (usada en el panel, fondo oscuro)
├── data/                   → base de datos normalizada y georreferenciada
│   ├── efectores.json/.js
│   ├── municipios.json/.js
│   ├── taxonomia.json/.js
│   ├── colectivos.json/.js → base de datos estática de colectivos y conexiones por partido
│   └── resumen.json
├── procesamiento/          → scripts que generan la base de datos
│   ├── build_data.py       → extracción + normalización + geocodificación
│   ├── export_js.py        → genera los archivos .js (incluyendo colectivos.js)
│   ├── generar_pdf.py      → genera documentacion.html y Documentacion_Panel_Salud_Comunitaria.pdf
│   └── geocode_cache.json  → caché de geocodificación (Nominatim)
└── docs/                   → documentación del proyecto
```

## Documentación

- [`DICCIONARIO_DATOS.md`](./docs/DICCIONARIO_DATOS.md) — campos de cada archivo de datos.
- [`PROCESO_DATOS.md`](./docs/PROCESO_DATOS.md) — qué se hizo con cada archivo fuente.
- [`FUENTES.md`](./docs/FUENTES.md) — listado de fuentes originales.
- [`Documentacion_Panel_Salud_Comunitaria.pdf`](./docs/Documentacion_Panel_Salud_Comunitaria.pdf) — documento resumen en PDF (para la presentación).

## Stack técnico

| Capa | Tecnología |
|------|-----------|
| Hosting | [GitHub Pages](https://piaunahuradmin.github.io/mapa-salud-comunitaria/) (despliegue estático continuo) |
| UI | HTML + [daisyUI](https://daisyui.com/) (tema oscuro personalizado `salud`) sobre Tailwind CSS 4 |
| Mapa | [Leaflet](https://leafletjs.com/) + teselas oscuras Esri Dark Gray Canvas |
| Ruteo vial | [OSRM](https://project-osrm.org/) (OpenStreetMap Routing) para trazado sobre calles y avenidas |
| Datos | JSON estático embebido (sin backend ni dependencias de servidor en runtime) |
| Transporte | Matriz estática de líneas de colectivos comunales e interurbanas de la RS VII |
| Geocodificación | [Nominatim](https://nominatim.openstreetmap.org/) (OpenStreetMap) |
| Procesamiento | Python (openpyxl, urllib, json) |
