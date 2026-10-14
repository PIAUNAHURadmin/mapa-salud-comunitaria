/* ==========================================================================
   Panel de Salud Comunitaria · UNAHUR
   Lógica de Aplicación conforme al Manual de Estilo UX/UI (docs/UXUI.pdf)
   ========================================================================== */

(function () {
  "use strict";

  // ---------------------------------------------------------------- Datos
  const EFECTORES = window.EFECTORES || [];
  const MUNICIPIOS = window.MUNICIPIOS || [];
  const TAXONOMIA = window.TAXONOMIA || [];
  const COLECTIVOS = window.COLECTIVOS || { lineas_por_partido: {}, conexiones_interurbanas: [] };

  // ---------------------------------------------------------------- Utilidades
  const $ = (id) => document.getElementById(id);
  const setText = (id, text) => {
    const el = $(id);
    if (el) el.textContent = text;
  };
  const setHtml = (id, html) => {
    const el = $(id);
    if (el) el.innerHTML = html;
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function formatDistancia(km) {
    if (km == null || !isFinite(km)) return "";
    if (km < 1) {
      return `${Math.round(km * 1000)} m`;
    }
    return `${km.toFixed(1).replace(".", ",")} km`;
  }

  // ---------------------------------------------------------------- Estado Global
  const state = {
    vistaActual: "inicio",
    vistaPrevia: "inicio",
    categoria: "todas", // "todas" | "caps" | "hospitales" | "vacunacion" | "salud-mental" | "odontologia" | "rehabilitacion" | "oftalmologia" | "otros"
    municipio: "",
    texto: "",
    ubicacion: null, // { lat, lon, label }
    efectorSeleccionado: null,
    origenRuteo: "ficha", // "ficha" | "mapa"
    favoritos: [], // Array de nombres de efectores
    ultimoEliminadoFav: null, // para Deshacer
    debounceTimer: null,
    sheetExpandido: false,
    scrollPrevioResultados: 0,
    rutasCalculadas: []
  };

  // Cargar favoritos de localStorage
  try {
    const saved = localStorage.getItem("unahur_salud_favoritos");
    if (saved) state.favoritos = JSON.parse(saved);
  } catch (e) {
    state.favoritos = [];
  }

  function guardarFavoritosStorage() {
    try {
      localStorage.setItem("unahur_salud_favoritos", JSON.stringify(state.favoritos));
    } catch (e) {}
    actualizarBadgesFavoritos();
  }

  function actualizarBadgesFavoritos() {
    const count = state.favoritos.length;
    const headerBadge = $("header-fav-count");
    const bottomBadge = $("bottom-fav-count");
    if (headerBadge) headerBadge.textContent = count;
    if (bottomBadge) {
      bottomBadge.textContent = count;
      bottomBadge.style.display = count > 0 ? "inline-flex" : "none";
    }
  }

  // ---------------------------------------------------------------- Notificaciones Toast (role="status")
  let toastTimeout = null;
  function mostrarToast(mensaje, permitirDeshacer = false, onDeshacer = null) {
    const toast = $("toast-notificacion");
    const msgSpan = $("toast-mensaje");
    const btnUndo = $("btn-toast-undo");
    if (!toast || !msgSpan) return;

    if (toastTimeout) clearTimeout(toastTimeout);

    msgSpan.textContent = mensaje;
    if (permitirDeshacer && onDeshacer) {
      btnUndo.style.display = "inline-block";
      btnUndo.onclick = () => {
        onDeshacer();
        ocultarToast();
      };
    } else {
      btnUndo.style.display = "none";
      btnUndo.onclick = null;
    }

    toast.classList.add("show");
    toastTimeout = setTimeout(() => {
      ocultarToast();
    }, 4500);
  }

  function ocultarToast() {
    const toast = $("toast-notificacion");
    if (toast) toast.classList.remove("show");
  }

  // ---------------------------------------------------------------- Mapa Leaflet (Claro Carto Voyager)
  let map = null;
  let marcadores = []; // { efector, marker }
  let userMarker = null;
  let lineaRutaMapa = null;
  let capasRuteoMapa = [];

  function initMap() {
    if (map) return;
    // Centro general de la Región Sanitaria VII
    map = L.map("mapa", {
      zoomControl: false,
      attributionControl: true
    }).setView([-34.62, -58.74], 11);

    // Esri ArcGIS World_Street_Map: libre de bloqueos 403, funciona tanto desde file:/// como localhost, sin API key
    L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {
      attribution: '&copy; <a href="https://www.esri.com/" target="_blank">Esri</a> &copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    // Controles de zoom manuales
    $("btn-map-zoom-in")?.addEventListener("click", () => map && map.zoomIn());
    $("btn-map-zoom-out")?.addEventListener("click", () => map && map.zoomOut());
    $("btn-map-gps")?.addEventListener("click", () => solicitarGeolocalizacion());

    // Clic en el mapa para fijar ubicación del usuario
    map.on("click", (e) => {
      fijarUbicacionUsuario(e.latlng.lat, e.latlng.lng, "Punto marcado en el mapa");
    });
  }

  function getIconForEfector(r, isSelected = false) {
    const isHospital = esHospital(r);
    const className = isHospital ? "custom-pin-hospital" : "custom-pin-caps";
    const selectedClass = isSelected ? " custom-pin-selected" : "";
    
    // Icono SVG según tipo
    const svgIcon = isHospital
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="16" height="20" x="4" y="2" rx="2"/><path d="M12 6v4"/><path d="M10 8h4"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 11v6"/><path d="M9 14h6"/></svg>`;

    return L.divIcon({
      className: "custom-pin-wrapper",
      html: `<div class="${className}${selectedClass}" title="${esc(r.nombre)}">${svgIcon}</div>`,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -18]
    });
  }

  function limpiarMarcadores() {
    marcadores.forEach((m) => m.marker.remove());
    marcadores.length = 0;
  }

  function construirPopup(r) {
    const isHosp = esHospital(r);
    const badgeHtml = isHosp
      ? `<span class="badge-hospital">Hospital</span>`
      : `<span class="badge-caps">CAPS · Primer nivel</span>`;
    const distText = r._dist != null && isFinite(r._dist) ? `<div style="font-size: 12px; color: var(--action); font-weight: 600; margin-top: 4px;">📍 A ${formatDistancia(r._dist)} de vos</div>` : "";

    return `
      <div style="min-width: 220px; font-family: var(--font-ui); padding: 2px;">
        <div style="margin-bottom: 6px;">${badgeHtml}</div>
        <div style="font-weight: 700; font-size: 14px; color: var(--ink); line-height: 1.3;">${esc(r.nombre)}</div>
        <div style="font-size: 12px; color: var(--muted); margin-top: 4px;">${esc(r.domicilio)}</div>
        <div style="font-size: 12px; color: var(--muted); font-weight: 500;">${esc(r.partido)}</div>
        ${distText}
        <div style="margin-top: 10px; display: flex; flex-direction: column; gap: 6px;">
          <button type="button" class="button button--primary" onclick="window.ruteoDesdeMapa('${esc(r.nombre)}')" style="min-height: 36px; padding: 6px 12px; font-size: 12px; width: 100%;">
            🧭 Cómo llegar
          </button>
          <button type="button" class="button button--secondary" onclick="window.abrirFichaDesdeMapa('${esc(r.nombre)}')" style="min-height: 32px; padding: 4px 12px; font-size: 12px; width: 100%;">
            Ver ficha completa
          </button>
        </div>
      </div>
    `;
  }

  // ---------------------------------------------------------------- Clasificación y Filtros
  function esHospital(r) {
    const nom = (r.nombre || "").toUpperCase();
    const sub = (r.subcategoria || "").toUpperCase();
    const niv = (r.nivel || "").toUpperCase();
    return sub.includes("SEGUNDO") || sub.includes("TERCER") || niv.includes("SEGUNDO") || niv.includes("TERCER") || nom.includes("HOSPITAL");
  }

  function cumpleCategoria(r, catKey) {
    if (!catKey || catKey === "todas") return true;
    const nom = (r.nombre || "").toLowerCase();
    const sub = (r.subcategoria || "").toLowerCase();
    const cat = (r.categoria || "").toLowerCase();
    const textAll = `${nom} ${sub} ${cat}`;

    switch (catKey) {
      case "caps":
        return !esHospital(r);
      case "hospitales":
        return esHospital(r);
      case "vacunacion":
        return textAll.includes("vacun") || textAll.includes("inmuniz") || !esHospital(r);
      case "salud-mental":
        return textAll.includes("mental") || textAll.includes("psicol") || textAll.includes("psiqui") || textAll.includes("cpa") || textAll.includes("adiccion");
      case "odontologia":
        return textAll.includes("odontol") || textAll.includes("dental") || textAll.includes("boca");
      case "rehabilitacion":
        return textAll.includes("rehab") || textAll.includes("kinesio") || textAll.includes("cemetri") || textAll.includes("estimulacion") || textAll.includes("terapia");
      case "oftalmologia":
        return textAll.includes("oftalmo") || textAll.includes("ojos") || textAll.includes("visual");
      case "otros":
        return textAll.includes("zoonosis") || textAll.includes("nutricion") || textAll.includes("sangre") || textAll.includes("complementario") || textAll.includes("mujer");
      default:
        return true;
    }
  }

  function filtrarEfectores() {
    const texto = state.texto.trim().toLowerCase();
    const res = EFECTORES.filter((r) => {
      if (!cumpleCategoria(r, state.categoria)) return false;
      if (state.municipio && r.partido !== state.municipio) return false;
      if (texto) {
        const busqueda = [r.nombre, r.domicilio, r.partido, r.categoria, r.subcategoria].join(" ").toLowerCase();
        if (!busqueda.includes(texto)) return false;
      }
      return true;
    });

    // Ordenamiento: si hay ubicación, por cercanía; si no, alfabético (Página 6)
    if (state.ubicacion) {
      res.forEach((r) => {
        if (r.lat != null && r.lon != null) {
          r._dist = haversineKm(state.ubicacion.lat, state.ubicacion.lon, r.lat, r.lon);
        } else {
          r._dist = Infinity;
        }
      });
      res.sort((a, b) => a._dist - b._dist);
      setText("sidebar-orden-label", "Orden: por cercanía (GPS)");
    } else {
      res.forEach((r) => { delete r._dist; });
      res.sort((a, b) => a.partido.localeCompare(b.partido) || a.nombre.localeCompare(b.nombre));
      setText("sidebar-orden-label", "Orden: alfabético");
    }

    renderResultados(res);
    actualizarMarcadoresMapa(res);
  }

  // ---------------------------------------------------------------- Render de Resultados
  function renderResultados(lista) {
    const listSidebar = $("sidebar-results-list");
    const listMobile = $("mobile-results-list");
    const countEl = $("sidebar-count");
    const countMobile = $("mobile-sheet-count");

    const totalText = `${lista.length} ${lista.length === 1 ? "establecimiento" : "establecimientos"}`;
    if (countEl) countEl.textContent = totalText;
    if (countMobile) countMobile.textContent = totalText;

    if (!lista.length) {
      const emptyHtml = `
        <div style="padding: 32px 16px; text-align: center; color: var(--muted);">
          <div style="font-size: 2rem; margin-bottom: 8px;">🔍</div>
          <div style="font-weight: 600; color: var(--ink); font-size: 1rem; margin-bottom: 4px;">
            No encontramos establecimientos con esta búsqueda
          </div>
          <p style="font-size: 0.85rem; margin-bottom: 16px;">
            Probá quitando filtros o buscando por otro término.
          </p>
          <button type="button" class="button button--secondary" onclick="window.limpiarTodosFiltros()" style="min-height: 38px; font-size: 0.85rem; padding: 6px 14px;">
            Limpiar filtros
          </button>
        </div>
      `;
      if (listSidebar) listSidebar.innerHTML = emptyHtml;
      if (listMobile) listMobile.innerHTML = emptyHtml;
      return;
    }

    const renderCard = (r, idx) => {
      const isHospital = esHospital(r);
      const isFav = state.favoritos.includes(r.nombre);
      const distBadge = r._dist != null && isFinite(r._dist) ? `<span class="result-distance">${formatDistancia(r._dist)}</span> · ` : "";
      const horarioText = "Horario no informado"; // Criterio estricto Página 8

      const item = document.createElement("div");
      item.className = "result-card-item";
      item.setAttribute("role", "article");
      item.setAttribute("tabindex", "0");
      item.setAttribute("aria-label", `${r.nombre}, en ${r.partido}`);
      if (state.efectorSeleccionado && state.efectorSeleccionado.nombre === r.nombre) {
        item.classList.add("active");
      }

      item.innerHTML = `
        <div class="result-card-main-row">
          <div class="result-icon-badge ${isHospital ? "hospital" : "caps"}" aria-hidden="true">
            ${isHospital ? "🏥" : "🏠"}
          </div>
          <div class="result-info">
            <div class="result-title">${esc(r.nombre)}</div>
            <div class="result-meta-row">
              ${distBadge}<span>${esc(r.partido)}</span>
            </div>
            <div class="result-hours">${esc(r.domicilio)} · ${esc(horarioText)}</div>
          </div>
          <div class="result-actions-wrap">
            <button type="button" class="fav-toggle-btn ${isFav ? "saved" : ""}" data-fav-name="${esc(r.nombre)}" title="${isFav ? "Quitar de favoritos" : "Guardar en favoritos"}" aria-label="${isFav ? "Quitar de favoritos" : "Guardar en favoritos"}" aria-pressed="${isFav}">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="${isFav ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
            </button>
            <span class="chevron-icon" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </span>
          </div>
        </div>
        <div class="result-card-actions">
          <button type="button" class="btn-card-llegar" title="Ver itinerario de colectivos">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
            Cómo llegar
          </button>
          <button type="button" class="btn-card-ver" title="Ver ficha completa">
            Ver ficha
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
      `;

      // Clic en el botón de favorito sin propagar
      const favBtn = item.querySelector(".fav-toggle-btn");
      favBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFavorito(r.nombre);
      });

      // Clic en Cómo llegar desde la tarjeta
      item.querySelector(".btn-card-llegar").addEventListener("click", (e) => {
        e.stopPropagation();
        mostrarComoLlegar(r, "mapa");
      });

      // Clic en Ver ficha
      item.querySelector(".btn-card-ver").addEventListener("click", (e) => {
        e.stopPropagation();
        abrirFicha(r);
      });

      // Clic en la fila completa
      item.addEventListener("click", () => {
        abrirFicha(r);
      });

      // Accesibilidad de teclado (Enter / Espacio abre la ficha)
      item.addEventListener("keydown", (e) => {
        if ((e.key === "Enter" || e.key === " ") && e.target === item) {
          e.preventDefault();
          abrirFicha(r);
        }
      });

      return item;
    };

    if (listSidebar) {
      listSidebar.innerHTML = "";
      lista.forEach((r, idx) => listSidebar.appendChild(renderCard(r, idx)));
    }
    if (listMobile) {
      listMobile.innerHTML = "";
      lista.forEach((r, idx) => listMobile.appendChild(renderCard(r, idx)));
    }
  }

  function actualizarMarcadoresMapa(lista) {
    if (!map) return;
    limpiarMarcadores();

    const puntos = [];
    lista.forEach((r) => {
      if (r.lat == null || r.lon == null) return;
      const marker = L.marker([r.lat, r.lon], {
        icon: getIconForEfector(r, state.efectorSeleccionado?.nombre === r.nombre)
      }).addTo(map);

      marker.bindPopup(construirPopup(r));

      marker.on("click", () => {
        state.efectorSeleccionado = r;
        // Resaltar la fila en el sidebar
        resaltarFilaEnLista(r.nombre);
      });

      marcadores.push({ efector: r, marker });
      puntos.push([r.lat, r.lon]);
    });

    if (puntos.length > 0 && !state.efectorSeleccionado) {
      map.fitBounds(L.latLngBounds(puntos).pad(0.12), { maxZoom: 14 });
    }
  }

  function resaltarFilaEnLista(nombre) {
    const rows = document.querySelectorAll(".result-card-item");
    rows.forEach((row) => {
      const match = row.getAttribute("aria-label")?.startsWith(nombre);
      if (match) {
        row.classList.add("active");
        row.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else {
        row.classList.remove("active");
      }
    });
  }

  // ---------------------------------------------------------------- Ficha de Establecimiento (Página 7)
  function abrirFicha(r) {
    state.efectorSeleccionado = r;
    const isHospital = esHospital(r);
    const isFav = state.favoritos.includes(r.nombre);

    // Guardar posición de scroll previa si estábamos en mapa
    const listEl = $("sidebar-results-list");
    if (listEl) state.scrollPrevioResultados = listEl.scrollTop;

    // Actualizar campos de la Ficha
    setText("ficha-nombre", r.nombre);
    setText("ficha-partido-subtitle", `${r.partido} · Región Sanitaria VII`);
    setText("ficha-domicilio", r.domicilio || "Dirección no especificada");

    const distWrap = $("ficha-distancia-wrap");
    if (distWrap) {
      if (r._dist != null && isFinite(r._dist)) {
        distWrap.textContent = `📍 A ${formatDistancia(r._dist)} de tu ubicación`;
        distWrap.style.display = "block";
      } else {
        distWrap.style.display = "none";
      }
    }

    const telEl = $("ficha-telefono");
    if (telEl) {
      if (r.telefono && r.telefono !== "-" && r.telefono.trim().length > 2) {
        telEl.innerHTML = `<a href="tel:${esc(r.telefono.replace(/[^\d+]/g, ""))}" style="font-weight: 600;">📞 ${esc(r.telefono)}</a>`;
      } else {
        telEl.innerHTML = `<span style="color: var(--muted);">Teléfono no informado</span>`;
      }
    }

    setText("ficha-horario", "Horario no informado"); // Criterio estricto Página 8

    // Badge de categoría
    const badgeCat = $("ficha-badge-cat");
    if (badgeCat) {
      badgeCat.innerHTML = isHospital
        ? `<span class="badge-hospital">Hospital · ${esc(r.nivel || "Segundo Nivel")}</span>`
        : `<span class="badge-caps">CAPS · Primer nivel</span>`;
    }

    // Lista de servicios con tildes verdes (Página 7)
    const servList = $("ficha-servicios-list");
    const serviciosBase = isHospital
      ? [
          "Guardia y emergencias 24 hs",
          "Clínica médica e internación",
          "Pediatría y neonatología",
          "Cirugía y traumatología",
          "Laboratorio y diagnóstico por imágenes",
          "Maternidad y salud reproductiva",
          "Farmacia hospitalaria gratuita"
        ]
      : [
          "Medicina general y atención primaria",
          "Control pediátrico y de la niñez",
          "Vacunatorio oficial de calendario",
          "Enfermería y curaciones",
          "Salud sexual y reproductiva",
          "Entrega de medicamentos esenciales",
          "Salud comunitaria y territorial"
        ];

    servList.innerHTML = serviciosBase
      .map(
        (s) => `
      <div class="service-check-item">
        <span class="service-check-icon">✓</span>
        <span>${esc(s)}</span>
      </div>`
      )
      .join("");

    // Botón de Favorito en Ficha
    actualizarBotonFavoritoFicha(isFav);

    // Botón "Cómo llegar" en Ficha
    const btnLlegar = $("btn-ficha-como-llegar");
    btnLlegar.onclick = () => {
      mostrarComoLlegar(r);
    };

    // Cambiar a la vista de ficha
    activarVista("ficha");
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Centrar marcador en mapa de fondo
    const m = marcadores.find((item) => item.efector.nombre === r.nombre);
    if (m && map) {
      map.setView([r.lat, r.lon], 15);
      m.marker.openPopup();
    }
  }

  function actualizarBotonFavoritoFicha(isFav) {
    const btnFav = $("btn-ficha-favorito");
    const favText = $("ficha-fav-text");
    const favIcon = $("ficha-fav-icon");
    if (!btnFav) return;

    if (isFav) {
      favText.textContent = "Quitar de favoritos";
      btnFav.classList.add("saved");
      favIcon.setAttribute("fill", "#ef4444");
      favIcon.style.color = "#ef4444";
    } else {
      favText.textContent = "Guardar en favoritos";
      btnFav.classList.remove("saved");
      favIcon.setAttribute("fill", "none");
      favIcon.style.color = "var(--action)";
    }

    btnFav.onclick = () => {
      if (state.efectorSeleccionado) {
        toggleFavorito(state.efectorSeleccionado.nombre);
        const nuevoEstado = state.favoritos.includes(state.efectorSeleccionado.nombre);
        actualizarBotonFavoritoFicha(nuevoEstado);
      }
    };
  }

  // ---------------------------------------------------------------- Favoritos
  function toggleFavorito(nombreEfector) {
    const index = state.favoritos.indexOf(nombreEfector);
    if (index >= 0) {
      state.favoritos.splice(index, 1);
      state.ultimoEliminadoFav = nombreEfector;
      guardarFavoritosStorage();
      mostrarToast(`Eliminado de favoritos`, true, () => {
        if (state.ultimoEliminadoFav) {
          state.favoritos.push(state.ultimoEliminadoFav);
          guardarFavoritosStorage();
          mostrarToast(`Restaurado a favoritos`);
          if (state.vistaActual === "favoritos") renderPantallaFavoritos();
          filtrarEfectores();
        }
      });
    } else {
      state.favoritos.push(nombreEfector);
      state.ultimoEliminadoFav = null;
      guardarFavoritosStorage();
      mostrarToast(`Guardado en favoritos`);
    }

    if (state.vistaActual === "favoritos") {
      renderPantallaFavoritos();
    }
    // Actualizar iconos de la lista
    const favButtons = document.querySelectorAll(`[data-fav-name="${CSS.escape(nombreEfector)}"]`);
    const isNowFav = state.favoritos.includes(nombreEfector);
    favButtons.forEach((btn) => {
      btn.classList.toggle("saved", isNowFav);
      btn.setAttribute("aria-pressed", isNowFav);
      const svg = btn.querySelector("svg");
      if (svg) svg.setAttribute("fill", isNowFav ? "currentColor" : "none");
    });
  }

  function renderPantallaFavoritos() {
    const container = $("favoritos-list-container");
    if (!container) return;

    const centrosFav = EFECTORES.filter((r) => state.favoritos.includes(r.nombre));

    if (!centrosFav.length) {
      container.innerHTML = `
        <div class="empty-favorites-box">
          <svg class="empty-fav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
          </svg>
          <div class="empty-fav-text">Todavía no guardaste establecimientos</div>
          <p style="font-size: 0.9rem; color: var(--muted); max-width: 380px;">
            Hacé clic en el corazón de cualquier centro de salud para guardarlo acá y acceder más rápido.
          </p>
          <button type="button" class="button button--primary" onclick="window.irABuscar()" style="min-height: 44px; margin-top: 8px;">
            Buscar servicios
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = "";
    centrosFav.forEach((r) => {
      const isHospital = esHospital(r);
      const distBadge = r._dist != null && isFinite(r._dist) ? `<span class="result-distance">${formatDistancia(r._dist)}</span> · ` : "";

      const card = document.createElement("div");
      card.className = "result-card-item";
      card.style.border = "1px solid var(--line)";
      card.style.borderRadius = "var(--radius-card)";
      card.style.marginBottom = "8px";

      card.innerHTML = `
        <div class="result-icon-badge ${isHospital ? "hospital" : "caps"}" aria-hidden="true">
          ${isHospital ? "🏥" : "🏠"}
        </div>
        <div class="result-info">
          <div class="result-title">${esc(r.nombre)}</div>
          <div class="result-meta-row">
            ${distBadge}<span>${esc(r.partido)}</span> · <span>${esc(r.domicilio)}</span>
          </div>
        </div>
        <div class="result-actions-wrap">
          <button type="button" class="fav-toggle-btn saved" data-fav-name="${esc(r.nombre)}" title="Quitar de favoritos" aria-label="Quitar de favoritos">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
          </button>
          <button type="button" class="button button--ghost" style="padding: 4px 8px; font-size: 0.85rem; color: var(--action);">
            Ver detalle
          </button>
        </div>
      `;

      card.querySelector(".fav-toggle-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        toggleFavorito(r.nombre);
      });

      card.addEventListener("click", () => {
        abrirFicha(r);
      });

      container.appendChild(card);
    });
  }

  // ---------------------------------------------------------------- Navegación y Vistas (SPA)
  function activarVista(vista) {
    state.vistaPrevia = state.vistaActual;
    state.vistaActual = vista;

    const vistas = ["inicio", "mapa", "ficha", "favoritos", "info"];
    vistas.forEach((v) => {
      const el = $(`view-${v}`);
      if (el) el.classList.toggle("hidden", v !== vista);
    });

    // Actualizar botones del header
    $("btn-nav-inicio")?.classList.toggle("active", vista === "inicio");
    $("btn-nav-mapa")?.classList.toggle("active", vista === "mapa");
    $("btn-nav-favoritos")?.classList.toggle("active", vista === "favoritos");
    $("btn-nav-info")?.classList.toggle("active", vista === "info");

    // Actualizar botones de navegación móvil inferior
    $("btn-bottom-inicio")?.classList.toggle("active", vista === "inicio");
    $("btn-bottom-mapa")?.classList.toggle("active", vista === "mapa");
    $("btn-bottom-buscar")?.classList.toggle("active", vista === "mapa" && state.texto !== "");
    $("btn-bottom-favoritos")?.classList.toggle("active", vista === "favoritos");

    // Drawer links
    $("drawer-link-inicio")?.classList.toggle("active", vista === "inicio");
    $("drawer-link-mapa")?.classList.toggle("active", vista === "mapa");
    $("drawer-link-favoritos")?.classList.toggle("active", vista === "favoritos");
    $("drawer-link-info")?.classList.toggle("active", vista === "info");

    // Si pasamos al mapa, redimensionar Leaflet
    if (vista === "mapa") {
      setTimeout(() => {
        if (!map) initMap();
        map.invalidateSize();
        filtrarEfectores();
        // Restaurar scroll de resultados
        const listEl = $("sidebar-results-list");
        if (listEl && state.scrollPrevioResultados > 0) {
          listEl.scrollTop = state.scrollPrevioResultados;
        }
      }, 50);
    }

    if (vista === "favoritos") {
      renderPantallaFavoritos();
    }

    cerrarDrawer();
  }

  // ---------------------------------------------------------------- Geolocalización
  function solicitarGeolocalizacion() {
    const labelStatus = $("label-gps-status");
    if (!navigator.geolocation) {
      if (labelStatus) labelStatus.textContent = "Geolocalización no soportada en este navegador.";
      mostrarToast("Tu navegador no soporta geolocalización");
      return;
    }

    if (labelStatus) labelStatus.textContent = "Obteniendo ubicación GPS…";
    mostrarToast("Obteniendo tu ubicación GPS…");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        fijarUbicacionUsuario(latitude, longitude, "Tu ubicación (GPS)");
        if (labelStatus) labelStatus.textContent = "📍 Ubicación detectada";
        mostrarToast("Ubicación obtenida correctamente");
      },
      (err) => {
        console.warn("Error GPS:", err);
        if (labelStatus) labelStatus.textContent = "Podés buscar por nombre o dirección";
        mostrarToast("No pudimos obtener tu ubicación GPS");
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  function fijarUbicacionUsuario(lat, lon, label = "Tu ubicación") {
    // Requisito 1: Al cambiar la ubicación actual, borrar la línea de "Cómo llegar" si existe
    borrarRutaColectivo();

    state.ubicacion = { lat, lon, label };

    if (!map) initMap();

    if (userMarker) {
      userMarker.setLatLng([lat, lon]);
    } else {
      userMarker = L.marker([lat, lon], {
        icon: L.divIcon({
          className: "user-location-pin-wrap",
          html: `<div class="user-location-pin" title="${esc(label)}"></div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        })
      }).addTo(map);
      userMarker.bindPopup(`<strong>📍 ${esc(label)}</strong>`);
    }

    const legendUser = $("legend-user-item");
    if (legendUser) legendUser.style.display = "flex";

    filtrarEfectores();
  }

  // ---------------------------------------------------------------- Asistente Cómo Llegar en Colectivo (Modal)
  function obtenerMunicipioCercano(lat, lon) {
    if (!MUNICIPIOS.length) return "Hurlingham";
    let minD = Infinity;
    let cer = MUNICIPIOS[0].nombre;
    MUNICIPIOS.forEach((m) => {
      const d = haversineKm(lat, lon, m.lat, m.lon);
      if (d < minD) {
        minD = d;
        cer = m.nombre;
      }
    });
    return cer;
  }

  function borrarRutaColectivo() {
    if (lineaRutaMapa && map) {
      map.removeLayer(lineaRutaMapa);
      lineaRutaMapa = null;
    }
    cerrarRuteoFlotante();
  }

  function cerrarRuteoFlotante() {
    const panel = $("panel-flotante-ruteo");
    if (panel) panel.classList.add("hidden");
    const mobileRuteo = $("mobile-ruteo-container");
    if (mobileRuteo) mobileRuteo.classList.add("hidden");
    const mobileResultsList = $("mobile-results-list");
    if (mobileResultsList) mobileResultsList.classList.remove("hidden");
  }

  async function mostrarComoLlegar(r, origenTrigger = "ficha") {
    state.origenRuteo = origenTrigger;
    state.efectorSeleccionado = r;

    // 1. Pasar a la vista de Mapa para encuadrar la ubicación y el efector
    activarVista("mapa");

    // 2. Asegurar que el sidebar izquierdo mantenga el listado visible
    const panelFiltros = $("sidebar-panel-filtros");
    if (panelFiltros) panelFiltros.classList.remove("hidden");

    // 3. Determinar origen (GPS si existe, o centroide de Hurlingham/partido cercano)
    let origenLat, origenLon, origenNombre;
    if (state.ubicacion) {
      origenLat = state.ubicacion.lat;
      origenLon = state.ubicacion.lon;
      origenNombre = state.ubicacion.label;
    } else {
      const muniDef = MUNICIPIOS.find((m) => m.nombre === "Hurlingham") || MUNICIPIOS[0];
      origenLat = muniDef ? muniDef.lat : -34.59;
      origenLon = muniDef ? muniDef.lon : -58.63;
      origenNombre = "Hurlingham (Ubicación de referencia)";
    }

    const destinoPartido = r.partido;
    const distKm = haversineKm(origenLat, origenLon, r.lat, r.lon);
    const distTexto = formatDistancia(distKm);

    // 4. Limpiar cualquier traza previa en el mapa (no dibujamos rutas viales inventadas para colectivos)
    if (lineaRutaMapa && map) {
      map.removeLayer(lineaRutaMapa);
      lineaRutaMapa = null;
    }

    // 5. Encuadrar el mapa para mostrar tu punto de partida y el efector de salud
    if (map) {
      if (state.ubicacion) {
        const bounds = L.latLngBounds([
          [origenLat, origenLon],
          [r.lat, r.lon]
        ]);
        map.fitBounds(bounds, { padding: [70, 70], maxZoom: 15 });
      } else {
        map.setView([r.lat, r.lon], 15);
      }

      // Abrir popup en el destino
      const m = marcadores.find((item) => item.efector.nombre === r.nombre);
      if (m) m.marker.openPopup();
    }

    setText("floating-ruteo-subtitulo", `${r.nombre} (${destinoPartido})`);

    // 6. Deep links oficiales de transporte público con coordenadas exactas
    const gmapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origenLat},${origenLon}&destination=${r.lat},${r.lon}&travelmode=transit`;
    const moovitUrl = `https://moovitapp.com/?from=${origenLat},${origenLon}&to=${r.lat},${r.lon}`;

    const ruteoInfoHtml = `
      <div style="background-color: var(--selected); padding: 12px; border-radius: var(--radius-control); border: 1px solid var(--action);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
          <span style="font-size: 0.775rem; font-weight: 700; color: var(--action); text-transform: uppercase;">Destino</span>
          <span style="font-size: 0.85rem; font-weight: 700; color: var(--ink);">~${distTexto}</span>
        </div>
        <div style="font-size: 0.95rem; font-weight: 700; color: var(--ink); line-height: 1.25;">
          ${esc(r.nombre)}
        </div>
        <div style="font-size: 0.8rem; color: var(--muted); margin-top: 3px;">
          📍 ${esc(r.domicilio)} (${esc(destinoPartido)})
        </div>
      </div>

      <div style="background-color: var(--surface-soft); padding: 12px; border-radius: var(--radius-control); border: 1px solid var(--line); font-size: 0.825rem; color: var(--ink); line-height: 1.45;">
        <strong style="display: flex; align-items: center; gap: 6px; color: var(--ink); margin-bottom: 6px;">
          <span>🚌</span> Colectivos y paradas en tiempo real:
        </strong>
        Para asegurar que veas <strong>únicamente las líneas de colectivo que realmente pasan por tu zona y llegan a este centro de salud</strong> (con paradas exactas, ramales específicos y horarios SUBE/CNRT en vivo), abrí el recorrido en las plataformas oficiales de transporte:
      </div>

      <div style="font-size: 0.75rem; color: var(--muted); line-height: 1.35; padding: 0 2px;">
        <em>Origen: ${esc(origenNombre)}</em>
      </div>
    `;

    // 7. Mostrar panel flotante en la esquina superior izquierda del mapa
    const ruteoContenido = $("floating-ruteo-contenido");
    if (ruteoContenido) ruteoContenido.innerHTML = ruteoInfoHtml;

    const btnMaps = $("btn-ruteo-maps");
    if (btnMaps) {
      btnMaps.href = gmapsUrl;
      btnMaps.textContent = "Google Maps (Colectivo)";
    }

    const btnMoovit = $("btn-ruteo-moovit");
    if (btnMoovit) {
      btnMoovit.href = moovitUrl;
      btnMoovit.textContent = "Moovit";
    }

    const panelFlotante = $("panel-flotante-ruteo");
    if (panelFlotante) panelFlotante.classList.remove("hidden");

    // Sincronizar en móvil si corresponde
    const mobileRuteoContainer = $("mobile-ruteo-container");
    if (mobileRuteoContainer) {
      mobileRuteoContainer.innerHTML = `
        ${ruteoInfoHtml}
        <div style="margin-top: 14px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
          <a href="${gmapsUrl}" target="_blank" rel="noopener noreferrer" class="btn-accion-ruteo btn-accion-ruteo-maps">Google Maps</a>
          <a href="${moovitUrl}" target="_blank" rel="noopener noreferrer" class="btn-accion-ruteo btn-accion-ruteo-moovit">Moovit</a>
        </div>
        <div style="margin-top: 10px;">
          <button type="button" class="button button--secondary" onclick="window.cerrarRuteoFlotante()" style="width: 100%; min-height: 40px;">
            Cerrar
          </button>
        </div>
      `;
      const mobileResultsList = $("mobile-results-list");
      if (mobileResultsList) mobileResultsList.classList.add("hidden");
      mobileRuteoContainer.classList.remove("hidden");
    }

    const sheet = $("mobile-bottom-sheet");
    if (sheet) {
      sheet.classList.add("expanded");
      state.sheetExpandido = true;
      const toggleText = $("sheet-toggle-text");
      if (toggleText) toggleText.textContent = "Contraer resultados";
    }
  }

  function volverDesdeRuteo() {
    cerrarRuteoFlotante();
    if (state.origenRuteo === "ficha" && state.efectorSeleccionado) {
      activarVista("ficha");
    }
  }

  function cerrarModalRuteo() {
    const modal = $("modal-como-llegar-container");
    if (modal) modal.classList.remove("open");
  }

  // ---------------------------------------------------------------- Drawer Menú Lateral
  function abrirDrawer() {
    $("drawer-backdrop")?.classList.add("open");
    $("drawer-menu")?.classList.add("open");
    $("btn-abrir-menu")?.setAttribute("aria-expanded", "true");
    $("btn-cerrar-drawer")?.focus();
  }

  function cerrarDrawer() {
    $("drawer-backdrop")?.classList.remove("open");
    $("drawer-menu")?.classList.remove("open");
    $("btn-abrir-menu")?.setAttribute("aria-expanded", "false");
  }

  // ---------------------------------------------------------------- Bottom Sheet Móvil
  function toggleBottomSheet() {
    const sheet = $("mobile-bottom-sheet");
    const toggleText = $("sheet-toggle-text");
    const toggleIcon = $("sheet-toggle-icon");
    if (!sheet) return;

    state.sheetExpandido = !state.sheetExpandido;
    sheet.classList.toggle("expanded", state.sheetExpandido);

    if (toggleText) toggleText.textContent = state.sheetExpandido ? "Contraer resultados" : "Expandir resultados";
    if (toggleIcon) {
      toggleIcon.innerHTML = state.sheetExpandido ? '<path d="m6 9 6 6 6-6"/>' : '<path d="m18 15-6-6-6 6"/>';
    }
  }

  // ---------------------------------------------------------------- Inicialización y Listeners
  function inicializarEventos() {
    // Logo en Header vuelve al inicio
    $("nav-brand-logo")?.addEventListener("click", (e) => {
      e.preventDefault();
      activarVista("inicio");
    });

    // Enlaces de navegación escritorio
    $("btn-nav-inicio")?.addEventListener("click", () => activarVista("inicio"));
    $("btn-nav-mapa")?.addEventListener("click", () => activarVista("mapa"));
    $("btn-nav-favoritos")?.addEventListener("click", () => activarVista("favoritos"));
    $("btn-nav-info")?.addEventListener("click", () => activarVista("info"));

    // Navegación móvil inferior
    $("btn-bottom-inicio")?.addEventListener("click", () => activarVista("inicio"));
    $("btn-bottom-mapa")?.addEventListener("click", () => activarVista("mapa"));
    $("btn-bottom-buscar")?.addEventListener("click", () => {
      activarVista("mapa");
      setTimeout(() => $("input-busqueda-sidebar")?.focus(), 150);
    });
    $("btn-bottom-favoritos")?.addEventListener("click", () => activarVista("favoritos"));
    $("btn-bottom-mas")?.addEventListener("click", () => abrirDrawer());

    // Drawer lateral móvil
    $("btn-abrir-menu")?.addEventListener("click", () => abrirDrawer());
    $("btn-cerrar-drawer")?.addEventListener("click", () => cerrarDrawer());
    $("drawer-backdrop")?.addEventListener("click", () => cerrarDrawer());

    $("drawer-link-inicio")?.addEventListener("click", () => activarVista("inicio"));
    $("drawer-link-mapa")?.addEventListener("click", () => activarVista("mapa"));
    $("drawer-link-buscar")?.addEventListener("click", () => {
      activarVista("mapa");
      setTimeout(() => $("input-busqueda-sidebar")?.focus(), 150);
    });
    $("drawer-link-favoritos")?.addEventListener("click", () => activarVista("favoritos"));
    $("drawer-link-info")?.addEventListener("click", () => activarVista("info"));

    // Tecla Escape cierra modales y drawer (Página 7)
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        cerrarDrawer();
        cerrarModalRuteo();
      }
    });

    // Botones del Hero de Inicio
    $("btn-gps-home")?.addEventListener("click", () => solicitarGeolocalizacion());
    $("btn-explorar-todo")?.addEventListener("click", () => {
      state.categoria = "todas";
      activarVista("mapa");
    });

    // Tarjetas de categoría en Inicio (Página 1 y 5)
    document.querySelectorAll(".category-card").forEach((card) => {
      card.addEventListener("click", () => {
        const cat = card.getAttribute("data-cat");
        state.categoria = cat || "todas";
        // Actualizar chips de filtro
        document.querySelectorAll(".filter-chip").forEach((chip) => {
          chip.classList.toggle("active", chip.getAttribute("data-cat") === state.categoria);
        });
        activarVista("mapa");
      });
    });

    // Chips de categoría en el sidebar del mapa
    document.querySelectorAll(".filter-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        document.querySelectorAll(".filter-chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        state.categoria = chip.getAttribute("data-cat") || "todas";
        filtrarEfectores();
      });
    });

    // Llenar selector de Municipios en sidebar
    const selectMuni = $("select-partido-sidebar");
    if (selectMuni && MUNICIPIOS.length) {
      MUNICIPIOS.forEach((m) => {
        const opt = document.createElement("option");
        opt.value = m.nombre;
        opt.textContent = m.nombre;
        selectMuni.appendChild(opt);
      });
      selectMuni.addEventListener("change", (e) => {
        state.municipio = e.target.value;
        filtrarEfectores();
      });
    }

    // Buscador en Home (con debounce de 300 ms, Página 6)
    const inputHome = $("input-busqueda-home");
    const clearHome = $("btn-limpiar-home");
    if (inputHome) {
      inputHome.addEventListener("input", (e) => {
        clearHome?.classList.toggle("visible", e.target.value.length > 0);
        clearTimeout(state.debounceTimer);
        state.debounceTimer = setTimeout(() => {
          state.texto = e.target.value;
          if (e.target.value.trim().length > 1) {
            $("input-busqueda-sidebar").value = state.texto;
            activarVista("mapa");
          }
        }, 300);
      });

      inputHome.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          state.texto = inputHome.value;
          $("input-busqueda-sidebar").value = state.texto;
          activarVista("mapa");
        }
      });
    }
    clearHome?.addEventListener("click", () => {
      if (inputHome) inputHome.value = "";
      clearHome.classList.remove("visible");
      state.texto = "";
    });

    // Buscador en Sidebar del Mapa (con debounce de 300 ms)
    const inputSidebar = $("input-busqueda-sidebar");
    const clearSidebar = $("btn-limpiar-sidebar");
    if (inputSidebar) {
      inputSidebar.addEventListener("input", (e) => {
        clearSidebar?.classList.toggle("visible", e.target.value.length > 0);
        clearTimeout(state.debounceTimer);
        state.debounceTimer = setTimeout(() => {
          state.texto = e.target.value;
          filtrarEfectores();
        }, 300);
      });

      inputSidebar.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          state.texto = inputSidebar.value;
          filtrarEfectores();
        }
      });
    }
    clearSidebar?.addEventListener("click", () => {
      if (inputSidebar) inputSidebar.value = "";
      clearSidebar.classList.remove("visible");
      state.texto = "";
      filtrarEfectores();
    });

    // Botones de volver y limpiar en sidebar
    $("btn-sidebar-volver-inicio")?.addEventListener("click", () => activarVista("inicio"));
    $("btn-sidebar-limpiar")?.addEventListener("click", () => window.limpiarTodosFiltros());

    // Botón volver en Ficha
    $("btn-ficha-volver")?.addEventListener("click", () => {
      activarVista("mapa");
    });

    // Bottom sheet móvil
    $("btn-toggle-sheet")?.addEventListener("click", toggleBottomSheet);
    $("btn-mobile-sheet-list")?.addEventListener("click", () => {
      state.sheetExpandido = true;
      $("mobile-bottom-sheet")?.classList.add("expanded");
      setText("sheet-toggle-text", "Contraer resultados");
    });

    // Panel flotante Cómo llegar en colectivo (esquina superior izquierda)
    $("btn-cerrar-ruteo-x")?.addEventListener("click", cerrarRuteoFlotante);
    $("btn-floating-cerrar")?.addEventListener("click", cerrarRuteoFlotante);
    $("btn-ruteo-volver")?.addEventListener("click", () => volverDesdeRuteo());

    // Modal Cómo llegar (fallback)
    $("btn-cerrar-modal-ruteo")?.addEventListener("click", cerrarModalRuteo);
    $("btn-cerrar-modal-accion")?.addEventListener("click", cerrarModalRuteo);
    $("modal-como-llegar-container")?.addEventListener("click", (e) => {
      if (e.target === $("modal-como-llegar-container")) cerrarModalRuteo();
    });

    // Actualizar badges
    actualizarBadgesFavoritos();
  }

  // Funciones expuestas globalmente
  window.limpiarTodosFiltros = function () {
    borrarRutaColectivo();
    state.categoria = "todas";
    state.municipio = "";
    state.texto = "";
    if ($("input-busqueda-sidebar")) $("input-busqueda-sidebar").value = "";
    if ($("input-busqueda-home")) $("input-busqueda-home").value = "";
    if ($("btn-limpiar-sidebar")) $("btn-limpiar-sidebar").classList.remove("visible");
    if ($("btn-limpiar-home")) $("btn-limpiar-home").classList.remove("visible");
    if ($("select-partido-sidebar")) $("select-partido-sidebar").value = "";
    document.querySelectorAll(".filter-chip").forEach((chip) => {
      chip.classList.toggle("active", chip.getAttribute("data-cat") === "todas");
    });
    filtrarEfectores();
  };

  window.cerrarRuteoFlotante = function () {
    cerrarRuteoFlotante();
  };

  window.borrarRutaColectivo = function () {
    borrarRutaColectivo();
  };

  window.seleccionarRuta = function (routeId) {
    activarRuta(routeId);
  };

  window.abrirFichaDesdeMapa = function (nombre) {
    const efector = EFECTORES.find((e) => e.nombre === nombre);
    if (efector) abrirFicha(efector);
  };

  window.ruteoDesdeMapa = function (nombre) {
    const efector = EFECTORES.find((e) => e.nombre === nombre);
    if (efector) mostrarComoLlegar(efector, "mapa");
  };

  window.volverDesdeRuteo = function () {
    volverDesdeRuteo();
  };

  window.irABuscar = function () {
    activarVista("mapa");
  };

  // ---------------------------------------------------------------- Arranque
  document.addEventListener("DOMContentLoaded", () => {
    inicializarEventos();
    // Actualizar stats de inicio
    if ($("home-stat-efectores")) $("home-stat-efectores").textContent = EFECTORES.length || 313;
  });
})();
