# Plan de Implementación en WordPress · Panel de Salud Comunitaria

Este documento detalla la estrategia técnica y el paso a paso para embeber el **Panel de Salud Comunitaria (Región Sanitaria VII)** dentro de un portal institucional desarrollado en **WordPress** (UNAHUR o dependencias sanitarias), garantizando el mejor rendimiento, aislamiento de estilos y soporte pleno de geolocalización.

---

## 🧭 Diagnóstico Técnico y Estrategia Recomendada

El proyecto está construido como una **Single Page Application (SPA)** autónoma, sin dependencias de backend, con estilos CSS propios (`styles.css`), librerías cartográficas (Leaflet) y persistencia en `localStorage`.

### Comparativa de Métodos de Integración

| Método | Aislamiento CSS / JS | Geolocalización (GPS) | Mantenimiento | Complejidad | Recomendación |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **1. iFrame Responsivo Optimizado** | 🟢 Total (Cero conflicto) | 🟢 Plena (con directiva `allow`) | 🟢 Automático vía GitHub Pages / Subdominio | 🟢 Mínima (1 bloque HTML) | **⭐ RECOMENDADO** |
| **2. Shortcode en functions.php** | 🟢 Total | 🟢 Plena | 🟢 Centralizado en el Child Theme | 🟡 Baja | **⭐ RECOMENDADO** |
| **3. Subdominio / Subcarpeta Dedicada** | 🟢 Total | 🟢 Plena | 🟢 Independiente de WordPress | 🟡 Media (DevOps/Hosting) | **Ideal para URLs oficiales** |
| **4. Inyección Nativa en Plantilla PHP** | 🔴 Alto riesgo de colisión CSS | 🟢 Plena | 🔴 Alto (afectado por plugins/updates de WP) | 🔴 Alta | ❌ Desaconsejado |

> **Conclusión**: El método óptimo y estándar en portales universitarios y gubernamentales es el **iFrame Responsivo con atributos de permisos**, ya sea insertado directamente mediante un bloque HTML en el editor (Gutenberg / Elementor) o encapsulado en un **Shortcode institucional**. Evita colisiones con jQuery, temas pesados o plugins de WordPress.

---

## 🛠️ Método 1: iFrame Responsivo con Delegación de Permisos (Recomendado)

Permite consumir la versión desplegada en **GitHub Pages** (o en un hosting institucional estático) sin preocuparse por actualizaciones en el WordPress: cada vez que se hace `git push`, el mapa embebido se actualiza automáticamente.

### Requisitos Previos Indispensables
1. **HTTPS Obligatorio**: Tanto el sitio de WordPress como la URL del mapa deben servirse bajo `https://`. Si el sitio de WordPress no tiene SSL, los navegadores **bloquearán la geolocalización GPS** por motivos de seguridad.
2. **Atributo `allow="geolocation"`**: Es mandatorio para que el navegador del usuario le permita al iframe acceder al GPS del dispositivo.

### Código para Bloque "HTML Personalizado" (Gutenberg o Elementor)

Crea una página nueva en WordPress (por ejemplo: `Servicios de Salud`) y añade el siguiente bloque HTML:

```html
<!-- ==========================================================================
     Contenedor Institucional: Mapa de Salud Comunitaria UNAHUR
     ========================================================================== -->
<div class="unahur-mapa-salud-wrapper">
  <iframe
    id="iframe-mapa-salud"
    src="https://piaunahuradmin.github.io/mapa-salud-comunitaria/"
    title="Panel de Salud Comunitaria - Universidad Nacional de Hurlingham"
    loading="lazy"
    allow="geolocation; clipboard-write"
    referrerpolicy="no-referrer-when-downgrade"
  ></iframe>
</div>

<style>
  /* Contenedor adaptativo sin márgenes intrusivos */
  .unahur-mapa-salud-wrapper {
    position: relative;
    width: 100%;
    /* Altura dinámica: ocupa casi toda la pantalla visible descontando cabeceras de WordPress */
    height: calc(100vh - 120px);
    min-height: 650px;
    margin: 0 auto;
    overflow: hidden;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(23, 43, 52, 0.08);
    background-color: #f2f7f8;
  }

  /* Iframe a pantalla completa del contenedor */
  .unahur-mapa-salud-wrapper iframe {
    display: block;
    width: 100%;
    height: 100%;
    border: none;
    margin: 0;
    padding: 0;
  }

  /* Ajuste para dispositivos móviles */
  @media (max-width: 768px) {
    .unahur-mapa-salud-wrapper {
      height: calc(100dvh - 80px); /* 100dvh previene recortes por la barra de navegación del navegador */
      min-height: 550px;
      border-radius: 0;
    }
  }
</style>
```

---

## 🔌 Método 2: Integración mediante Shortcode en WordPress

Si se desea que los editores de contenido puedan insertar el mapa en cualquier página o entrada escribiendo simplemente `[mapa_salud]` o `[mapa_salud altura="800px"]`, se puede registrar un shortcode en el archivo `functions.php` del tema hijo (*Child Theme*).

### Código para `functions.php`

```php
<?php
// Añadir en el functions.php del tema hijo o en un plugin de utilidades
function unahur_registrar_shortcode_mapa_salud($atts) {
    $atributos = shortcode_atts(array(
        'url'    => 'https://piaunahuradmin.github.io/mapa-salud-comunitaria/',
        'altura' => 'calc(100vh - 140px)',
        'min_h'  => '650px'
    ), $atts, 'mapa_salud');

    $url_limpia = esc_url($atributos['url']);
    $altura     = esc_attr($atributos['altura']);
    $min_h      = esc_attr($atributos['min_h']);

    ob_start();
    ?>
    <div class="mapa-salud-shortcode-container" style="width: 100%; height: <?php echo $altura; ?>; min-height: <?php echo $min_h; ?>; position: relative; overflow: hidden; border-radius: 8px; box-shadow: 0 4px 16px rgba(23, 43, 52, 0.08);">
        <iframe 
            src="<?php echo $url_limpia; ?>"
            title="Panel de Salud Comunitaria UNAHUR"
            style="width: 100%; height: 100%; border: 0; display: block;"
            loading="lazy"
            allow="geolocation; clipboard-write"
            referrerpolicy="no-referrer-when-downgrade">
        </iframe>
    </div>
    <?php
    return ob_get_clean();
}
add_shortcode('mapa_salud', 'unahur_registrar_shortcode_mapa_salud');
```

**Uso en el editor de WordPress:**
* Básico: `[mapa_salud]`
* Personalizado: `[mapa_salud altura="90vh" min_h="700px"]`

---

## 🎨 Ajustes de Diseño recomendados en WordPress (UX/UI)

Para que el mapa se integre de forma profesional y parezca parte nativa del sitio institucional:

1. **Configuración de Plantilla de Página en WordPress**:
   * En los ajustes laterales de la página en WordPress, seleccionar la plantilla **"Ancho Completo"** (*Full Width* o *Canvas / Sin barras laterales*).
   * Desactivar la barra lateral de widgets (sidebar) para que el mapa disponga de todo el ancho del monitor.
2. **Desactivar títulos repetitivos**:
   * Ocultar el título H1 generado por defecto por el tema de WordPress si se prefiere que la pantalla de inicio del mapa (`¿QUÉ NECESITÁS BUSCAR HOY?`) sea lo primero que vea el usuario.
3. **Evitar doble barra de desplazamiento (Scroll)**:
   * Al usar `calc(100vh - {altura_cabecera_wp})`, el mapa encaja exactamente en el espacio sobrante de la pantalla sin obligar al usuario a hacer scroll en la página contenedora para explorar el mapa o la lista.

---

## 🌐 Método 3: Alojamiento en Subdominio o Subcarpeta Propia (Opcional)

Si la universidad prefiere alojar los archivos en sus propios servidores (Apache/Nginx) en lugar de GitHub Pages:

### Estructura en el Servidor
Subir todo el contenido de este repositorio a una carpeta web:
* **Opción A (Subdirectorio)**: `/var/www/html/mapa-salud/` accesible vía `https://www.unahur.edu.ar/mapa-salud/`
* **Opción B (Subdominio)**: `https://saludcomunitaria.unahur.edu.ar/`

### Encabezados de Seguridad Recomendados (Nginx / Apache)
Para permitir que el WordPress institucional embeba el mapa sin que los navegadores bloqueen la carga por políticas de iframe:

**En Nginx:**
```nginx
# Permitir que el sitio principal de la UNAHUR pueda embeber el mapa en un iframe
add_header Content-Security-Policy "frame-ancestors 'self' https://*.unahur.edu.ar;" always;
# Encabezado de permisos para garantizar GPS en el iframe
add_header Permissions-Policy "geolocation=(self 'https://*.unahur.edu.ar')" always;
```

**En Apache (`.htaccess`):**
```apache
<IfModule mod_headers.c>
    Header set Content-Security-Policy "frame-ancestors 'self' https://*.unahur.edu.ar;"
    Header set Permissions-Policy "geolocation=(self 'https://*.unahur.edu.ar')"
</IfModule>
```

---

## ✅ Lista de Verificación (Checklist de Validación)

Antes de dar por finalizada la publicación en WordPress, verificar los siguientes puntos:

- [ ] **HTTPS Activo**: La página del WordPress institucional cuenta con candado SSL válido.
- [ ] **GPS Funcional**: Al hacer clic en *"Usar mi ubicación"* o presionar el icono 📍 en el mapa embebido, el navegador solicita permiso de ubicación y ubica correctamente al usuario.
- [ ] **Comportamiento Móvil**: En smartphones (Android/iOS), el Bottom Navigation Bar y el panel inferior deslizable (*Bottom Sheet*) responden correctamente al tacto sin interferir con el menú del sitio institucional.
- [ ] **Enlaces de Transporte**: Al hacer clic en *"Cómo llegar"* y presionar **Google Maps** o **Moovit**, se abre la ruta en una **pestaña nueva** (`target="_blank"`) sin cerrar la página de WordPress.
- [ ] **Favoritos**: La función de *"Guardar en favoritos"* persiste los datos en el navegador del usuario mediante `localStorage` incluso si recarga la página de WordPress.
- [ ] **Scroll Limpio**: No se genera un conflicto de doble scroll vertical molesto en pantallas medianas o grandes.
