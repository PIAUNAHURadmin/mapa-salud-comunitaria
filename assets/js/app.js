/* Panel de Salud Comunitaria · Región Sanitaria VII
   Lógica de mapa (Leaflet) + filtros + resultados. Los datos llegan por
   window.EFECTORES / window.MUNICIPIOS / window.TAXONOMIA. */
(function () {
  "use strict";

  const EFECTORES = window.EFECTORES || [];
  const MUNICIPIOS = window.MUNICIPIOS || [];
  const TAXONOMIA = window.TAXONOMIA || [];
  const COLECTIVOS = window.COLECTIVOS || { lineas_por_partido: {}, conexiones_interurbanas: [] };

  // ---------------------------------------------------------------- utilidades
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371, toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ---------------------------------------------------------------- colores por tipo
  const COLORS = {
    "Primer Nivel": "#10b981",
    "Segundo Nivel": "#22a8d8",
    "Tercer Nivel": "#a78bfa",
    "NUTRICIÓN Y ALIMENTACIÓN": "#f5a524",
  };
  const colorFor = (r) => (r.nivel ? COLORS[r.nivel] : COLORS[r.categoria]) || "#94a3b8";

  const NIVEL_LABEL = { "Primer Nivel": "1º nivel", "Segundo Nivel": "2º nivel", "Tercer Nivel": "3º nivel" };

  // ---------------------------------------------------------------- estado
  const state = {
    categoria: "",
    subcategoria: "",
    municipio: "",
    texto: "",
    ubicacion: null, // {lat, lon, label}
    marcadorUsuario: null,
    lineaRutaMapa: null,
  };

  // ---------------------------------------------------------------- mapa
  const map = L.map("mapa", { zoomControl: true, attributionControl: true }).setView([-34.6, -58.8], 10);
  L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);

  const marcadores = []; // {efector, marker}

  function limpiarMarcadores() {
    marcadores.forEach((m) => m.marker.remove());
    marcadores.length = 0;
    if (state.lineaRutaMapa) {
      map.removeLayer(state.lineaRutaMapa);
      state.lineaRutaMapa = null;
    }
  }

  function construirPopup(r) {
    const nivel = r.nivel ? `<span class="badge badge-sm border-[#a78bfa]/40 bg-[#a78bfa]/10 text-[#c4b5fd] font-medium">${esc(NIVEL_LABEL[r.nivel] || r.nivel)}</span>` : "";
    const tel = r.telefono && r.telefono !== "-" ? `<div class="text-xs text-[#9aa7ba] mt-1 flex items-center gap-1.5"><span>📞</span><span>${esc(r.telefono)}</span></div>` : "";
    return `
      <div class="min-w-[230px] p-0.5 text-[#dbe4f0]">
        <div class="font-bold text-sm text-white leading-snug">${esc(r.nombre)}</div>
        <div class="text-xs text-[#9aa7ba] mt-1">${esc(r.domicilio)}</div>
        <div class="text-xs text-[#9aa7ba]">${esc(r.partido)}</div>
        ${tel}
        <div class="mt-2 flex items-center justify-between gap-1">
          ${nivel}
        </div>
        <button onclick="window.abrirRuteoEfector('${esc(r.nombre)}')" class="btn-popup-ruteo">
          <span>🚌</span> Cómo llegar en colectivo
        </button>
      </div>`;
  }



  // ---------------------------------------------------------------- render de marcadores y lista
  function filtrar() {
    const texto = state.texto.trim().toLowerCase();
    const res = EFECTORES.filter((r) => {
      if (state.categoria && r.categoria !== state.categoria) return false;
      if (state.subcategoria && r.subcategoria !== state.subcategoria) return false;
      if (state.municipio && r.partido !== state.municipio) return false;
      if (texto) {
        const hay = [r.nombre, r.domicilio, r.subcategoria, r.categoria, r.partido].join(" ").toLowerCase();
        if (!hay.includes(texto)) return false;
      }
      return true;
    });

    // ordenar por distancia si hay ubicación
    if (state.ubicacion) {
      res.forEach((r) => {
        if (r.lat != null) r._dist = haversineKm(state.ubicacion.lat, state.ubicacion.lon, r.lat, r.lon);
        else r._dist = Infinity;
      });
      res.sort((a, b) => a._dist - b._dist);
    } else {
      res.sort((a, b) => a.partido.localeCompare(b.partido) || a.nombre.localeCompare(b.nombre));
    }

    limpiarMarcadores();
    res.forEach((r) => {
      if (r.lat == null) return;
      const color = colorFor(r);
      const marker = L.circleMarker([r.lat, r.lon], {
        radius: 7,
        color: "#0d1420",
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.85,
      }).addTo(map);
      marker.bindPopup(construirPopup(r));
      marcadores.push({ efector: r, marker });
    });

    if (res.length) {
      const puntos = marcadores.map((m) => [m.efector.lat, m.efector.lon]);
      map.fitBounds(L.latLngBounds(puntos).pad(0.15), { maxZoom: 13 });
    }

    renderLista(res);
    $("stat-visibles").textContent = res.length;
    $("badge-resultados").textContent = res.length;
  }

  function renderLista(res) {
    const cont = $("lista-resultados");
    if (!res.length) {
      cont.innerHTML = "";
      const div = document.createElement("div");
      div.id = "placeholder-resultados";
      div.className = "text-sm text-base-content/50 p-4 text-center";
      div.textContent = "No hay resultados para los filtros seleccionados.";
      cont.appendChild(div);
      return;
    }
    cont.innerHTML = "";
    res.forEach((r, idx) => {
      const li = document.createElement("div");
      li.className = "w-full text-left rounded-box border border-base-300 bg-base-100 hover:bg-base-300 transition p-3 cursor-pointer";
      const color = colorFor(r);
      const dist = r._dist != null && isFinite(r._dist) ? `<span class="badge badge-sm badge-secondary">${r._dist < 1 ? (r._dist * 1000).toFixed(0) + " m" : r._dist.toFixed(1) + " km"}</span>` : "";
      li.innerHTML = `
        <div class="flex items-start gap-2">
          <span class="mt-1 h-3 w-3 rounded-full shrink-0" style="background:${color}"></span>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-sm leading-snug">${esc(r.nombre)}</div>
            <div class="text-xs text-base-content/60 truncate">${esc(r.domicilio)}</div>
            <div class="text-xs text-base-content/60">${esc(r.partido)}${r.nivel ? " · " + esc(r.nivel) : ""}</div>
          </div>
          <div class="shrink-0 flex flex-col items-end gap-1">${dist}</div>
        </div>
        <div class="mt-2.5 pt-2 border-t border-base-200">
          <button type="button" class="btn-lista-ruteo btn-como-llegar-item">
            <span>🚌</span> Cómo llegar en colectivo
          </button>
        </div>`;
      li.querySelector(".btn-como-llegar-item").addEventListener("click", (e) => {
        e.stopPropagation();
        mostrarComoLlegar(r);
      });
      li.addEventListener("click", () => {
        const m = marcadores[idx];
        if (m) {
          map.setView([m.efector.lat, m.efector.lon], 15);
          m.marker.openPopup();
        }
      });
      cont.appendChild(li);
    });
  }

  // ---------------------------------------------------------------- ruteo en transporte público
  function obtenerMunicipioCercano(lat, lon) {
    if (!MUNICIPIOS.length) return "";
    let minD = Infinity;
    let cer = MUNICIPIOS[0].nombre;
    MUNICIPIOS.forEach((m) => {
      const d = haversineKm(lat, lon, m.lat, m.lon);
      if (d < minD) { minD = d; cer = m.nombre; }
    });
    return cer;
  }

  async function mostrarComoLlegar(r) {
    if (!state.ubicacion) {
      $("label-ubicacion").textContent = "⚠️ Indicá tu ubicación (GPS, dirección o clic en el mapa) para calcular el colectivo.";
      $("input-ubicacion").focus();
      alert("Para calcular las líneas de colectivo y el trayecto a este efector, primero indicá tu ubicación en el buscador o haciendo clic en el mapa.");
      return;
    }

    // Cerrar el popup sobre el marcador del centro médico para que no tape la traza en el mapa
    map.closePopup();

    const origenPartido = obtenerMunicipioCercano(state.ubicacion.lat, state.ubicacion.lon);
    const destinoPartido = r.partido;

    // Obtener traza real sobre calles y avenidas por donde circulan los colectivos (OSRM)
    let rutaCoords = [
      [state.ubicacion.lat, state.ubicacion.lon],
      [r.lat, r.lon]
    ];
    let distKm = haversineKm(state.ubicacion.lat, state.ubicacion.lon, r.lat, r.lon);

    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${state.ubicacion.lon},${state.ubicacion.lat};${r.lon},${r.lat}?overview=full&geometries=geojson`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        if (data && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          rutaCoords = route.geometry.coordinates.map((c) => [c[1], c[0]]);
          distKm = route.distance / 1000;
        }
      }
    } catch (e) {
      console.warn("No se pudo obtener traza detallada de calles, usando traza directa:", e);
    }

    // Dibujar línea visual en mapa con el recorrido real por calles
    if (state.lineaRutaMapa) map.removeLayer(state.lineaRutaMapa);
    state.lineaRutaMapa = L.polyline(rutaCoords, {
      color: "#38bdf8",
      weight: 5,
      opacity: 0.95,
      lineCap: "round",
      lineJoin: "round"
    }).addTo(map);

    // Ajustar encuadre con margen suficiente para que ambos puntos y el trayecto completo sean visibles
    map.fitBounds(state.lineaRutaMapa.getBounds().pad(0.35));

    // Obtener líneas locales e interurbanas
    const lineasDestino = COLECTIVOS.lineas_por_partido[destinoPartido] || [];
    const lineasOrigen = COLECTIVOS.lineas_por_partido[origenPartido] || [];
    const interurbanas = (COLECTIVOS.conexiones_interurbanas || []).filter((c) =>
      (c.origen === origenPartido && c.destino === destinoPartido) ||
      (c.origen === destinoPartido && c.destino === origenPartido)
    );

    const esMismoPartido = origenPartido === destinoPartido;
    const distTexto = distKm < 1 ? (distKm * 1000).toFixed(0) + " metros" : distKm.toFixed(1) + " km";
    const tiempoEst = Math.max(8, Math.round(10 + (distKm / 18) * 60));

    $("modal-ruteo-subtitulo").innerHTML = `
      <span class="text-emerald-400 font-semibold">${esc(origenPartido)}</span>
      <span class="text-slate-500 mx-1.5">➔</span>
      <span class="text-sky-300 font-bold">${esc(r.nombre)}</span>
      <span class="text-slate-400">(${esc(destinoPartido)})</span>`;

    // Itinerario detallado paso a paso con los colectivos específicos para la ruta
    let pasosHtml = "";
    if (esMismoPartido) {
      const lineaPrincipal = lineasDestino[0]?.linea || "local";
      const ramalPrincipal = lineasDestino[0]?.ramales || `recorrido por ${destinoPartido}`;
      const lineasAlt = lineasDestino.slice(1, 3).map((l) => `Línea ${l.linea}`).join(" o ");

      pasosHtml = `
        <li class="flex items-start gap-2.5">
          <span class="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[11px] shrink-0">1</span>
          <div>
            <strong class="text-white">Punto de partida:</strong> Caminá hacia la parada o avenida más próxima desde tu ubicación en <span class="text-emerald-400 font-semibold">${esc(origenPartido)}</span>.
          </div>
        </li>
        <li class="flex items-start gap-2.5">
          <span class="h-5 w-5 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center text-[11px] shrink-0">2</span>
          <div>
            <strong class="text-white">Tomar colectivo:</strong> Abordá la <span class="badge bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded text-xs">Línea ${esc(lineaPrincipal)}</span> ${lineasAlt ? `(o alternativamente <span class="text-slate-300 font-medium">${esc(lineasAlt)}</span>)` : ""} en dirección a <em>${esc(ramalPrincipal)}</em>.
          </div>
        </li>
        <li class="flex items-start gap-2.5">
          <span class="h-5 w-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-[11px] shrink-0">3</span>
          <div>
            <strong class="text-white">Dónde bajarse:</strong> Descendé en la parada más cercana a la altura de <span class="text-slate-200 font-medium">${esc(r.domicilio)}</span>.
          </div>
        </li>
        <li class="flex items-start gap-2.5">
          <span class="h-5 w-5 rounded-full bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center text-[11px] shrink-0">4</span>
          <div>
            <strong class="text-white">Llegada al efector:</strong> Caminá el último tramo hasta la entrada de <span class="text-white font-bold">${esc(r.nombre)}</span> (${distTexto} de trayecto total).
          </div>
        </li>`;
    } else {
      const lineasInter = interurbanas.flatMap((c) => c.lineas);
      if (lineasInter.length > 0) {
        const lineaDirecta = lineasInter[0];
        const lineaLocalDest = lineasDestino[0]?.linea;
        pasosHtml = `
          <li class="flex items-start gap-2.5">
            <span class="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[11px] shrink-0">1</span>
            <div>
              <strong class="text-white">Inicio en ${esc(origenPartido)}:</strong> Acercate a la parada de la traza interurbana o estación más cercana en <span class="text-emerald-400 font-semibold">${esc(origenPartido)}</span>.
            </div>
          </li>
          <li class="flex items-start gap-2.5">
            <span class="h-5 w-5 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center text-[11px] shrink-0">2</span>
            <div>
              <strong class="text-white">Colectivo interurbano directo:</strong> Tomá la <span class="badge bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded text-xs">Línea ${esc(lineaDirecta)}</span> ${lineasInter.length > 1 ? `(o <span class="text-slate-300 font-medium">Línea ${esc(lineasInter[1])}</span>)` : ""} con destino hacia <span class="text-sky-300 font-semibold">${esc(destinoPartido)}</span>.
            </div>
          </li>
          <li class="flex items-start gap-2.5">
            <span class="h-5 w-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-[11px] shrink-0">3</span>
            <div>
              <strong class="text-white">Ingreso y descenso en ${esc(destinoPartido)}:</strong> Seguí el trayecto marcado en el mapa hasta ${esc(destinoPartido)}. Bajate en la parada principal más próxima a <span class="text-slate-200">${esc(r.domicilio)}</span>.
            </div>
          </li>
          ${lineaLocalDest ? `
          <li class="flex items-start gap-2.5">
            <span class="h-5 w-5 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center text-[11px] shrink-0">4</span>
            <div>
              <strong class="text-white">Conexión local (opcional):</strong> Si el centro de salud no queda sobre la avenida, combiná con la <span class="badge bg-emerald-500/20 text-emerald-300 font-semibold px-2 py-0.5 rounded text-xs">Línea ${esc(lineaLocalDest)}</span> interna o caminá hacia el establecimiento.
            </div>
          </li>` : ""}
          <li class="flex items-start gap-2.5">
            <span class="h-5 w-5 rounded-full bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center text-[11px] shrink-0">${lineaLocalDest ? "5" : "4"}</span>
            <div>
              <strong class="text-white">Llegada:</strong> Arribo a <span class="text-white font-bold">${esc(r.nombre)}</span> en <span class="text-slate-300">${esc(r.domicilio)}</span> (~${tiempoEst} min estimados de viaje).
            </div>
          </li>`;
      } else {
        const lineaSalida = lineasOrigen[0]?.linea || "local";
        const lineaLlegada = lineasDestino[0]?.linea || "troncal";
        pasosHtml = `
          <li class="flex items-start gap-2.5">
            <span class="h-5 w-5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold flex items-center justify-center text-[11px] shrink-0">1</span>
            <div>
              <strong class="text-white">Salida desde ${esc(origenPartido)}:</strong> Tomá un colectivo de tu zona (ej. <span class="badge bg-slate-700 text-slate-200 font-bold px-2 py-0.5 rounded text-xs">Línea ${esc(lineaSalida)}</span>) hacia la estación de tren o centro de trasbordo más cercano.
            </div>
          </li>
          <li class="flex items-start gap-2.5">
            <span class="h-5 w-5 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-[11px] shrink-0">2</span>
            <div>
              <strong class="text-white">Punto de trasbordo regional:</strong> En el nodo de trasbordo, combiná con la <span class="badge bg-amber-500/20 text-amber-300 font-bold px-2 py-0.5 rounded text-xs">Línea ${esc(lineaLlegada)}</span> con recorrido en dirección a <span class="text-sky-300 font-semibold">${esc(destinoPartido)}</span>.
            </div>
          </li>
          <li class="flex items-start gap-2.5">
            <span class="h-5 w-5 rounded-full bg-sky-500/20 text-sky-400 font-bold flex items-center justify-center text-[11px] shrink-0">3</span>
            <div>
              <strong class="text-white">Dónde bajarse en ${esc(destinoPartido)}:</strong> Descendé en la parada más cercana a la altura de <span class="text-slate-200">${esc(r.domicilio)}</span>.
            </div>
          </li>
          <li class="flex items-start gap-2.5">
            <span class="h-5 w-5 rounded-full bg-purple-500/20 text-purple-400 font-bold flex items-center justify-center text-[11px] shrink-0">4</span>
            <div>
              <strong class="text-white">Arribo final:</strong> Caminá el tramo restante hasta la entrada de <span class="text-white font-bold">${esc(r.nombre)}</span> (${distTexto} de viaje total).
            </div>
          </li>`;
      }
    }

    let html = `
      <!-- Métricas -->
      <div class="grid grid-cols-3 gap-2 bg-base-100 rounded-xl p-3 text-center">
        <div class="flex flex-col">
          <span class="text-[11px] uppercase tracking-wider text-base-content/60 font-medium">Distancia</span>
          <span class="text-sm sm:text-base font-bold text-emerald-400 mt-0.5">${distTexto}</span>
        </div>
        <div class="flex flex-col">
          <span class="text-[11px] uppercase tracking-wider text-base-content/60 font-medium">Tiempo est.</span>
          <span class="text-sm sm:text-base font-bold text-sky-400 mt-0.5">~${tiempoEst} min</span>
        </div>
        <div class="flex flex-col">
          <span class="text-[11px] uppercase tracking-wider text-base-content/60 font-medium">Trayecto</span>
          <span class="text-xs font-semibold text-white mt-1 truncate" title="${esc(origenPartido)} ➔ ${esc(destinoPartido)}">${esc(origenPartido)} ➔ ${esc(destinoPartido)}</span>
        </div>
      </div>`;

    if (esMismoPartido) {
      html += `
        <div class="bg-base-100 rounded-xl p-4">
          <h4 class="font-bold text-sm text-emerald-400 flex items-center gap-1.5 mb-1.5">
            <span>✅ Colectivos locales en ${esc(destinoPartido)}</span>
          </h4>
          <p class="text-xs text-base-content/70 mb-3">
            Líneas que recorren ${esc(destinoPartido)} y te acercan a <strong class="text-white">${esc(r.nombre)}</strong>:
          </p>
          <div class="flex flex-wrap gap-2">
            ${lineasDestino.map((l) => `
              <span class="inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-300 font-semibold px-2.5 py-1.5 rounded-lg text-xs" title="${esc(l.ramales)}">
                <span>🚌</span>
                <span>Línea ${esc(l.linea)}</span>
                <span class="text-[10px] text-emerald-400/80 font-normal">(${esc(l.tipo)})</span>
              </span>`).join("")}
          </div>
        </div>`;
    } else {
      const lineasInter = interurbanas.flatMap((c) => c.lineas);
      html += `
        <div class="bg-base-100 rounded-xl p-4">
          <h4 class="font-bold text-sm text-amber-400 flex items-center gap-1.5 mb-1.5">
            <span>🔄 Conexión Interurbana (${esc(origenPartido)} ➔ ${esc(destinoPartido)})</span>
          </h4>
          ${lineasInter.length ? `
            <p class="text-xs text-base-content/70 mb-2">Líneas directas que conectan ambos municipios:</p>
            <div class="flex flex-wrap gap-2 mb-3">
              ${lineasInter.map((l) => `
                <span class="inline-flex items-center gap-1.5 bg-amber-500/15 text-amber-300 font-semibold px-2.5 py-1.5 rounded-lg text-xs">
                  <span>🚌</span>
                  <span>Línea ${esc(l)}</span>
                </span>`).join("")}
            </div>
          ` : `
            <p class="text-xs text-base-content/70 mb-2">Tomá un colectivo troncal en ${esc(origenPartido)} hacia el centro de trasbordo más cercano (ej. Estaciones de Morón, Merlo o Moreno) para combinar con las líneas de ${esc(destinoPartido)}.</p>
          `}

          <h5 class="font-semibold text-xs text-base-content/80 mt-1 mb-1.5">Líneas locales en el municipio de destino (${esc(destinoPartido)}):</h5>
          <div class="flex flex-wrap gap-1.5">
            ${lineasDestino.map((l) => `
              <span class="inline-flex items-center bg-base-300 text-base-content/90 text-xs px-2.5 py-1 rounded-md">
                Línea ${esc(l.linea)}
              </span>`).join("")}
          </div>
        </div>`;
    }

    html += `
      <div class="bg-base-100 rounded-xl p-4">
        <h4 class="font-bold text-xs uppercase tracking-wider text-base-content/70 mb-2.5 flex items-center gap-1.5">
          <span>🗺️ Guía paso a paso del recorrido</span>
        </h4>
        <ol class="space-y-3 text-xs text-base-content/90">
          ${pasosHtml}
        </ol>
      </div>`;

    $("modal-ruteo-contenido").innerHTML = html;

    const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${state.ubicacion.lat},${state.ubicacion.lon}&destination=${r.lat},${r.lon}&travelmode=transit`;
    const moovitUrl = `https://moovitapp.com/index/es/transporte_p%C3%Bublico-site_search?orig_lat=${state.ubicacion.lat}&orig_lng=${state.ubicacion.lon}&dest_lat=${r.lat}&dest_lng=${r.lon}`;

    $("btn-gmaps-transit").href = gmapsUrl;
    $("btn-moovit").href = moovitUrl;

    const modal = $("modal-como-llegar");
    if (modal && typeof modal.showModal === "function") {
      modal.showModal();
    }
  }

  window.abrirRuteoEfector = function (nombre) {
    const r = EFECTORES.find((e) => e.nombre === nombre);
    if (r) mostrarComoLlegar(r);
  };


  // ---------------------------------------------------------------- filtros (UI)
  function poblarSelects() {
    // categorías (de taxonomía, y si no hay taxonomía, de los datos)
    const cats = TAXONOMIA.length ? TAXONOMIA : uniq(EFECTORES.map((r) => r.categoria));
    const selCat = $("select-categoria");
    cats.forEach((c) => {
      const nombre = typeof c === "string" ? c : c.categoria;
      const o = document.createElement("option");
      o.value = nombre;
      o.textContent = nombre;
      selCat.appendChild(o);
    });

    const selMun = $("select-municipio");
    MUNICIPIOS.forEach((m) => {
      const o = document.createElement("option");
      o.value = m.nombre;
      o.textContent = m.nombre;
      selMun.appendChild(o);
    });

    selCat.addEventListener("change", () => {
      state.categoria = selCat.value;
      poblarSubcategorias();
      filtrar();
    });
    selMun.addEventListener("change", () => {
      state.municipio = selMun.value;
      filtrar();
    });
  }

  function poblarSubcategorias() {
    const sel = $("select-subcategoria");
    sel.innerHTML = '<option value="">Todos los servicios</option>';
    if (!state.categoria) { state.subcategoria = ""; sel.disabled = true; return; }
    sel.disabled = false;
    const cat = TAXONOMIA.find((c) => (typeof c === "string" ? c : c.categoria) === state.categoria);
    const subs = cat ? cat.subcategorias.map((s) => (typeof s === "string" ? s : s.nombre)) : uniq(EFECTORES.filter((r) => r.categoria === state.categoria).map((r) => r.subcategoria));
    subs.filter(Boolean).sort().forEach((s) => {
      const o = document.createElement("option");
      o.value = s;
      o.textContent = s;
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => {
      state.subcategoria = sel.value;
      filtrar();
    });
  }

  function uniq(arr) { return [...new Set(arr.filter(Boolean))]; }

  // ---------------------------------------------------------------- ubicación del usuario
  function setUbicacion(lat, lon, label) {
    state.ubicacion = { lat, lon, label };
    if (state.marcadorUsuario) map.removeLayer(state.marcadorUsuario);
    state.marcadorUsuario = L.marker([lat, lon], {
      icon: L.divIcon({ className: "", html: '<div style="width:14px;height:14px;border-radius:50%;background:#ef4444;border:2.5px solid #fff;box-shadow:0 0 0 3px rgba(239,68,68,.4)"></div>', iconSize: [14, 14], iconAnchor: [7, 7] }),
    }).addTo(map);
    state.marcadorUsuario.bindPopup("Tu ubicación").openPopup();
    $("label-ubicacion").textContent = label || "Ubicación marcada. Los resultados se ordenan por distancia.";
    map.setView([lat, lon], 12);
    filtrar();
  }

  function usarGeolocalizacion() {
    if (!navigator.geolocation) { $("label-ubicacion").textContent = "Tu navegador no soporta geolocalización."; return; }
    $("label-ubicacion").textContent = "Obteniendo ubicación…";
    navigator.geolocation.getCurrentPosition(
      (pos) => setUbicacion(pos.coords.latitude, pos.coords.longitude, "Ubicación obtenida por GPS."),
      () => { $("label-ubicacion").textContent = "No se pudo obtener la ubicación. Probá hacer clic en el mapa."; },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  function geocodificarTexto() {
    const q = $("input-ubicacion").value.trim();
    if (!q) return;
    $("label-ubicacion").textContent = "Buscando dirección…";
    fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ar&q=" + encodeURIComponent(q + ", Buenos Aires, Argentina"))
      .then((r) => r.json())
      .then((d) => {
        if (d && d[0]) setUbicacion(parseFloat(d[0].lat), parseFloat(d[0].lon), "Ubicación: " + d[0].display_name);
        else $("label-ubicacion").textContent = "No se encontró la dirección. Probá hacer clic en el mapa.";
      })
      .catch(() => { $("label-ubicacion").textContent = "No se pudo buscar la dirección. Hacé clic en el mapa."; });
  }

  // ---------------------------------------------------------------- notas metodológicas
  function renderNotas() {
    const notas = [
      { titulo: "Fuente de datos", texto: "Listados oficiales de establecimientos de la Provincia de Buenos Aires (sistemas.ms.gba.gov.ar), relevados por estudiantes de Salud Comunitaria en 2026." },
      { titulo: "Cobertura", texto: "Región Sanitaria VII: Hurlingham, Ituzaingó, Morón, Merlo, Moreno, Tres de Febrero, General Rodríguez, General Las Heras, Marcos Paz y Luján." },
      { titulo: "Georreferenciación", texto: "Las coordenadas se obtuvieron con OpenStreetMap (Nominatim). Los domicilios que no pudieron resolverse se ubicaron en el centro del municipio (marcado en la leyenda)." },
    ];
    $("notas-metodologia").innerHTML = notas.map((n) => `
      <div class="card bg-base-200 shadow-sm">
        <div class="card-body">
          <h3 class="card-title text-sm">${esc(n.titulo)}</h3>
          <p class="text-sm text-base-content/70">${esc(n.texto)}</p>
        </div>
      </div>`).join("");
  }

  function renderLeyenda() {
    const items = [
      ["Primer Nivel", COLORS["Primer Nivel"], "CAPS / centros de salud"],
      ["Segundo Nivel", COLORS["Segundo Nivel"], "hospitales generales"],
      ["Tercer Nivel", COLORS["Tercer Nivel"], "alta complejidad"],
      ["Nutrición", COLORS["NUTRICIÓN Y ALIMENTACIÓN"], "consultorios"],
    ];
    $("leyenda-mapa").innerHTML = `
      <div class="font-semibold mb-0.5">Referencias</div>` +
      items.map(([t, c, d]) => `
        <div class="flex items-center gap-2">
          <span class="h-3 w-3 rounded-full shrink-0" style="background:${c}"></span>
          <span class="text-base-content/80">${t}</span>
          <span class="text-base-content/40">${d}</span>
        </div>`).join("");
  }

  // ---------------------------------------------------------------- init
  function init() {
    $("stat-efectores").textContent = EFECTORES.length;
    $("stat-municipios").textContent = MUNICIPIOS.length;
    $("stat-categorias").textContent = TAXONOMIA.length || uniq(EFECTORES.map((r) => r.categoria)).length;
    poblarSelects();
    renderLeyenda();
    renderNotas();

    $("btn-milocalizacion").addEventListener("click", usarGeolocalizacion);
    $("input-ubicacion").addEventListener("keydown", (e) => { if (e.key === "Enter") geocodificarTexto(); });
    $("input-busqueda").addEventListener("input", () => { state.texto = $("input-busqueda").value; filtrar(); });
    $("btn-limpiar").addEventListener("click", () => {
      state.categoria = state.subcategoria = state.municipio = state.texto = "";
      state.ubicacion = null;
      if (state.marcadorUsuario) { map.removeLayer(state.marcadorUsuario); state.marcadorUsuario = null; }
      $("select-categoria").value = "";
      $("select-municipio").value = "";
      $("input-busqueda").value = "";
      $("input-ubicacion").value = "";
      poblarSubcategorias();
      $("label-ubicacion").textContent = "Podés también hacer clic en el mapa para marcar tu ubicación.";
      filtrar();
    });

    map.on("click", (e) => setUbicacion(e.latlng.lat, e.latlng.lng, "Ubicación marcada con un clic en el mapa."));

    filtrar();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
