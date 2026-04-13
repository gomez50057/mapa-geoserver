import L from "leaflet";

function styleActionButton(button) {
  button.style.width = "34px";
  button.style.height = "34px";
  button.style.display = "inline-flex";
  button.style.alignItems = "center";
  button.style.justifyContent = "center";
  button.style.border = "1px solid rgba(0,0,0,0.12)";
  button.style.borderRadius = "10px";
  button.style.background = "rgba(255,255,255,0.95)";
  button.style.backdropFilter = "blur(10px)";
  button.style.boxShadow = "0 10px 20px rgba(0,0,0,0.14)";
  button.style.cursor = "pointer";
  button.style.transition = "transform 120ms ease, box-shadow 120ms ease, background 120ms ease";
  button.style.color = "#7a1d31";
}

function bindHoverLift(button) {
  L.DomEvent.on(button, "mouseenter", () => {
    button.style.boxShadow = "0 14px 28px rgba(0,0,0,0.18)";
    button.style.transform = "translateY(-1px)";
  });
  L.DomEvent.on(button, "mouseleave", () => {
    if (!button.disabled) {
      button.style.boxShadow = "0 10px 20px rgba(0,0,0,0.14)";
      button.style.transform = "translateY(0)";
    }
  });
}

function createActionControl({ title, ariaLabel, iconMarkup, onClick }) {
  return L.Control.extend({
    options: { position: "topleft" },
    onAdd() {
      const wrapper = L.DomUtil.create("div", "leaflet-bar leaflet-control");
      wrapper.style.marginTop = "10px";
      wrapper.style.border = "none";
      wrapper.style.background = "transparent";

      const button = L.DomUtil.create("button", "", wrapper);
      button.type = "button";
      button.title = title;
      button.setAttribute("aria-label", ariaLabel);
      styleActionButton(button);
      button.innerHTML = iconMarkup;

      L.DomEvent.disableClickPropagation(wrapper);
      L.DomEvent.disableScrollPropagation(wrapper);
      L.DomEvent.on(button, "click", (event) => {
        L.DomEvent.preventDefault(event);
        L.DomEvent.stopPropagation(event);
        onClick();
      });
      bindHoverLift(button);

      return wrapper;
    },
  });
}

function createFullscreenControl({ map }) {
  return L.Control.extend({
    options: { position: "topleft" },
    onAdd() {
      const wrapper = L.DomUtil.create("div", "leaflet-bar leaflet-control");
      wrapper.style.marginTop = "10px";
      wrapper.style.border = "none";
      wrapper.style.background = "transparent";

      const button = L.DomUtil.create("button", "", wrapper);
      button.type = "button";
      button.title = "Pantalla completa";
      button.setAttribute("aria-label", "Pantalla completa");
      styleActionButton(button);
      button.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M8 4H4v4M16 4h4v4M20 16v4h-4M4 16v4h4"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      `;

      const getFullscreenTarget = () => document.fullscreenElement || document.webkitFullscreenElement;

      const updateVisualState = () => {
        const isFullscreen = !!getFullscreenTarget();
        button.style.background = isFullscreen
          ? "linear-gradient(135deg, #bc955b, #DEC9A3)"
          : "rgba(255,255,255,0.95)";
        button.style.color = isFullscreen ? "#691b32" : "#7a1d31";
        button.title = isFullscreen ? "Salir de pantalla completa" : "Pantalla completa";
        button.setAttribute("aria-label", button.title);
      };

      const requestFullscreen = async () => {
        const target = document.documentElement;
        if (target.requestFullscreen) return target.requestFullscreen();
        if (target.webkitRequestFullscreen) return target.webkitRequestFullscreen();
      };

      const exitFullscreen = async () => {
        if (document.exitFullscreen) return document.exitFullscreen();
        if (document.webkitExitFullscreen) return document.webkitExitFullscreen();
      };

      const handleToggle = async () => {
        try {
          if (getFullscreenTarget()) {
            await exitFullscreen();
          } else {
            await requestFullscreen();
          }
        } catch (error) {
          console.warn("No se pudo cambiar a pantalla completa", error);
        } finally {
          window.setTimeout(() => {
            updateVisualState();
            map.invalidateSize?.({ animate: false });
          }, 180);
        }
      };

      const handleFullscreenChange = () => {
        updateVisualState();
        window.setTimeout(() => {
          map.invalidateSize?.({ animate: false });
        }, 180);
      };

      updateVisualState();

      L.DomEvent.disableClickPropagation(wrapper);
      L.DomEvent.disableScrollPropagation(wrapper);
      L.DomEvent.on(button, "click", (event) => {
        L.DomEvent.preventDefault(event);
        L.DomEvent.stopPropagation(event);
        handleToggle();
      });
      bindHoverLift(button);

      document.addEventListener("fullscreenchange", handleFullscreenChange);
      document.addEventListener("webkitfullscreenchange", handleFullscreenChange);

      wrapper._codexCleanup = () => {
        document.removeEventListener("fullscreenchange", handleFullscreenChange);
        document.removeEventListener("webkitfullscreenchange", handleFullscreenChange);
      };

      return wrapper;
    },
  });
}

function createLocateControl({ map, locationOverlayRef }) {
  return L.Control.extend({
    options: { position: "topleft" },
    onAdd() {
      const wrapper = L.DomUtil.create("div", "leaflet-bar leaflet-control");
      wrapper.style.marginTop = "10px";
      wrapper.style.border = "none";
      wrapper.style.background = "transparent";

      const button = L.DomUtil.create("button", "", wrapper);
      button.type = "button";
      button.title = "Ir a mi ubicación";
      button.setAttribute("aria-label", "Ir a mi ubicación");
      styleActionButton(button);
      button.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v3m0 12v3M3 12h3m12 0h3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
          <circle cx="12" cy="12" r="5.2" fill="none" stroke="currentColor" stroke-width="1.8"/>
          <circle cx="12" cy="12" r="1.7" fill="currentColor"/>
        </svg>
      `;

      const setLoading = (loading) => {
        button.disabled = loading;
        button.style.cursor = loading ? "wait" : "pointer";
        button.style.opacity = loading ? "0.78" : "1";
        button.style.transform = loading ? "scale(0.98)" : "scale(1)";
      };

      const showMessage = (latlng, message) => {
        L.popup({ autoClose: true, closeButton: false, offset: [0, -16] })
          .setLatLng(latlng || map.getCenter())
          .setContent(
            `<div style="font-family:Montserrat,sans-serif;font-size:12px;color:#222;padding:2px 4px;">${message}</div>`
          )
          .openOn(map);
      };

      const handleLocate = () => {
        if (!navigator?.geolocation) {
          showMessage(map.getCenter(), "La ubicación no está disponible en este navegador.");
          return;
        }

        setLoading(true);
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const latlng = L.latLng(position.coords.latitude, position.coords.longitude);

            if (locationOverlayRef.current) {
              locationOverlayRef.current.remove();
            }

            const marker = L.circleMarker(latlng, {
              radius: 7,
              color: "#ffffff",
              weight: 2.2,
              fillColor: "#1d6fa5",
              fillOpacity: 1,
            }).bindPopup(
              `
                <div style="position:relative;font-family:Montserrat,sans-serif;display:grid;gap:6px;width:164px;padding-right:18px;line-height:1.2;">
                  <button
                    type="button"
                    data-close-location="true"
                    aria-label="Cerrar"
                    style="
                      position:absolute;
                      top:-4px;
                      right:-4px;
                      width:22px;
                      height:22px;
                      border:none;
                      border-radius:999px;
                      background:rgba(0,0,0,0.05);
                      color:#7d7d7d;
                      display:inline-flex;
                      align-items:center;
                      justify-content:center;
                      cursor:pointer;
                    "
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                  </button>
                  <strong style="font-size:12.5px;color:#202020;">Ubicación actual</strong>
                  <button
                    type="button"
                    data-remove-location="true"
                    style="
                      padding:8px 10px;
                      border:none;
                      border-radius:10px;
                      background:linear-gradient(135deg, rgba(122,29,49,0.08), rgba(188,149,91,0.18));
                      color:#7a1d31;
                      font-weight:700;
                      font-size:12px;
                      cursor:pointer;
                      box-shadow:0 8px 18px rgba(0,0,0,0.08);
                    "
                  >
                    Quitar ubicación
                  </button>
                </div>
              `,
              {
                offset: [0, -10],
                closeButton: false,
                className: "location-popup",
                autoPanPadding: [24, 24],
                minWidth: 192,
                maxWidth: 192,
              }
            );

            marker.on("popupopen", () => {
              const closeButton = document.querySelector('[data-close-location="true"]');
              const actionButton = document.querySelector('[data-remove-location="true"]');
              if (closeButton && closeButton.dataset.bound !== "true") {
                closeButton.dataset.bound = "true";
                closeButton.addEventListener("click", () => {
                  map.closePopup();
                });
              }
              if (!actionButton || actionButton.dataset.bound === "true") return;
              actionButton.dataset.bound = "true";
              actionButton.addEventListener("click", () => {
                locationOverlayRef.current?.remove?.();
                locationOverlayRef.current = null;
                map.closePopup();
              });
            });

            const group = L.layerGroup([marker]).addTo(map);
            locationOverlayRef.current = group;

            const targetZoom = Math.max(map.getZoom(), 16);
            map.flyTo(latlng, targetZoom, {
              duration: 0.85,
              easeLinearity: 0.22,
            });

            window.setTimeout(() => {
              marker.openPopup();
            }, 240);

            setLoading(false);
          },
          () => {
            showMessage(map.getCenter(), "No se pudo obtener tu ubicación.");
            setLoading(false);
          },
          {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 30000,
          }
        );
      };

      L.DomEvent.disableClickPropagation(wrapper);
      L.DomEvent.disableScrollPropagation(wrapper);
      L.DomEvent.on(button, "click", (event) => {
        L.DomEvent.preventDefault(event);
        L.DomEvent.stopPropagation(event);
        handleLocate();
      });
      bindHoverLift(button);

      return wrapper;
    },
  });
}

export function addMapControls({
  map,
  locationOverlayRef,
  onOpenImportPanel,
  onOpenExportPanel,
  onOpenDrawingPanel,
}) {
  const LocateControl = createLocateControl({ map, locationOverlayRef });
  const ImportControl = createActionControl({
    title: "Agregar KML o GeoJSON",
    ariaLabel: "Agregar KML o GeoJSON",
    onClick: onOpenImportPanel,
    iconMarkup: `
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M6 18.5h12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.45"/>
      </svg>
    `,
  });
  const ExportControl = createActionControl({
    title: "Descargar mapa en PDF",
    ariaLabel: "Descargar mapa en PDF",
    onClick: onOpenExportPanel,
    iconMarkup: `
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 4v9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <path d="M8.6 10.4L12 13.8l3.4-3.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M5 17.5h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        <rect x="4.5" y="16.5" width="15" height="3" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/>
      </svg>
    `,
  });
  const DrawingControl = createActionControl({
    title: "Herramientas de dibujo",
    ariaLabel: "Herramientas de dibujo",
    onClick: onOpenDrawingPanel,
    iconMarkup: `
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 18l5.5-1.3L19 7.2 16.8 5 7.3 14.5 6 20z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        <path d="M14.8 7l2.2 2.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `,
  });
  const FullscreenControl = createFullscreenControl({ map });

  const controls = [
    new LocateControl().addTo(map),
    new ImportControl().addTo(map),
    new ExportControl().addTo(map),
    new DrawingControl().addTo(map),
    new FullscreenControl().addTo(map),
  ];

  return () => {
    controls.forEach((control) => {
      control.getContainer?.()?._codexCleanup?.();
      map.removeControl(control);
    });
  };
}
