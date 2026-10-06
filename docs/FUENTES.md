# Fuentes de datos

Todos los datos provienen del relevamiento realizado por el equipo de **Salud
Comunitaria** de la Universidad Nacional de Hurlingham, a partir de fuentes
oficiales del Ministerio de Salud de la Provincia de Buenos Aires.

## Fuentes primarias

- **Sistema de atención / red de establecimientos** — `https://sistemas.ms.gba.gov.ar/redatencion/`
  (listados de establecimientos por partido, nivel de atención y especialidad).
- **Google Sheets** de trabajo del equipo (enlazados desde
  `REPOSITORIO DE ENLACES GEOREF.xlsx`).
- **Programa Qunita** (CAPS adheridos).
- **Instituto Provincial del Cáncer (IPC)** — establecimientos con banco de drogas,
  cuidados paliativos y radioterapia.

## Archivos originales (carpeta del relevamiento)

```
drive-download-20260929T120752Z-1-001/
├── CAPS/ …
├── CUD/ …
├── DATOS VINCULADOS A LA TABLA/
│   ├── EFECTORES DE SALUD PUBLICA/
│   │   ├── EFECTORES DE SALUD PRIMER NIVEL DE ATENCION/  (10 .xlsx)
│   │   ├── EFECTORES DE SALUD SEGUNDO NIVEL DE ATENCION/ (10 .xlsx)
│   │   └── EFECTORES DE SALUD TERCER NIVEL DE ATENCION/  (3 .xlsx)
│   └── NUTRICIÓN Y ALIMENTACIÓN/CONSULTORIOS DE NUTRICION/ (10 .xlsx)
├── Hosp. Provinciales y Nacionales/ …
├── Oncología/ …
├── Programa Qunita/ …
├── Salud sexual y reproductiva/ …
├── Lineamiento.docx
├── proyecto_panel_salud_comunitaria.docx
└── REPOSITORIO DE ENLACES GEOREF.xlsx
```

## Servicios externos y fuentes complementarias

- **Nominatim / OpenStreetMap** — geocodificación de domicilios
  (`https://nominatim.openstreetmap.org/`), licencia ODbL 1.0.
- **OSRM (Open Source Routing Machine) / OpenStreetMap** — motor de cálculo de ruteo vial
  (`https://router.project-osrm.org/`), licencia ODbL 1.0.
- **Red de Transporte Público Automotor (RS VII)** — relevamiento de líneas de colectivos comunales
  e interurbanas y matrices de conexión entre los 10 municipios del conurbano oeste (`data/colectivos.json`).
- **Google Maps Transit y Moovit** — servicios externos para consulta complementaria de frecuencias y
  horarios en tiempo real mediante deep links parametrizados.
- **Esri Dark Gray Canvas / OpenStreetMap** — teselas del mapa (fondo oscuro).
- **Leaflet** — biblioteca de mapas (BSD-2-Clause).
- **daisyUI + Tailwind CSS** — diseño de interfaz con tema oscuro personalizado (`salud`).

## Consideraciones

- Los datos están **vigentes a la fecha del relevamiento** (junio–septiembre 2026) y
  pueden variar.
- La información de contacto, horarios y requisitos **debe validarse** con los
  equipos territoriales antes de un uso productivo.
