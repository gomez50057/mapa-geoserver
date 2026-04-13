import React from "react";

export default function ImportLayerPanel({
  open,
  loading,
  error,
  sanitizeHelpOpen,
  onToggleHelp,
  onOpenHelp,
  onCloseHelp,
  onClose,
  onSelectFile,
}) {
  if (!open) return null;

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      style={{
        position: "absolute",
        top: 62,
        left: 54,
        zIndex: 20008,
        width: 298,
        padding: 14,
        borderRadius: 18,
        background: "rgba(255,255,255,0.96)",
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 18px 38px rgba(0,0,0,0.2)",
        backdropFilter: "blur(14px)",
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "grid", gap: 3 }}>
          <strong style={{ fontSize: 13, color: "#202020" }}>Subir una capa</strong>
        </div>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          style={{
            width: 28,
            height: 28,
            border: "none",
            borderRadius: 999,
            background: "rgba(0,0,0,0.05)",
            color: "#7d7d7d",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div
        style={{
          padding: "2px 0 0",
          display: "grid",
          gap: 10,
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 11, color: "#7a1d31", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>
            Formatos habilitados
          </span>
          <span style={{ fontSize: 12.5, color: "#2e2e2e" }}>KML y GeoJSON</span>
        </div>
        <div style={{ height: 1, background: "linear-gradient(90deg, rgba(122,29,49,0.12), rgba(188,149,91,0.22), rgba(122,29,49,0.04))" }} />
        <div style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 11, color: "#7a1d31", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>
            Validación
          </span>
          <span style={{ fontSize: 12.5, color: "#2e2e2e" }}>Limita tus archivos a 12 MB.</span>
        </div>
      </div>
      <div style={{ display: "grid", gap: 5 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <span style={{ fontSize: 11.5, color: "#666", lineHeight: 1.45 }}>
            Solo se leen geometrías y atributos de texto. El contenido se sanitiza antes de mostrarse.
          </span>
          <div
            style={{ position: "relative", flexShrink: 0 }}
            onMouseEnter={onOpenHelp}
            onMouseLeave={onCloseHelp}
          >
            <button
              type="button"
              aria-label="Cómo funciona la sanitización"
              onClick={onToggleHelp}
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                border: "1px solid rgba(122,29,49,0.14)",
                background: "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(188,149,91,0.12))",
                color: "#7a1d31",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 6px 12px rgba(0,0,0,0.08)",
                transition: "transform 120ms ease, box-shadow 120ms ease",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path d="M12 10.2V16.1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="12" cy="7.4" r="1.1" fill="currentColor" />
              </svg>
            </button>
            {sanitizeHelpOpen ? (
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: "calc(100% + 8px)",
                  width: 220,
                  padding: "10px 12px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.98)",
                  color: "#444",
                  fontSize: 11.5,
                  lineHeight: 1.5,
                  border: "1px solid rgba(122,29,49,0.12)",
                  boxShadow: "0 16px 30px rgba(0,0,0,0.12)",
                  zIndex: 8,
                }}
              >
                Revisamos el archivo como texto, extraemos solo geometrías y atributos, y convertimos caracteres especiales para que se muestren como texto en vez de ejecutarse.
              </div>
            ) : null}
          </div>
        </div>
        {error ? (
          <span
            style={{
              fontSize: 11.5,
              color: "#9f2241",
              background: "rgba(159,34,65,0.08)",
              border: "1px solid rgba(159,34,65,0.12)",
              padding: "8px 10px",
              borderRadius: 12,
            }}
          >
            {error}
          </span>
        ) : null}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button
          type="button"
          disabled={loading}
          onClick={onSelectFile}
          style={{
            flex: 1,
            padding: "11px 12px",
            borderRadius: 14,
            border: "1px solid rgba(122,29,49,0.14)",
            background: loading
              ? "rgba(0,0,0,0.05)"
              : "linear-gradient(135deg, rgba(122,29,49,0.08), rgba(188,149,91,0.18))",
            color: "#7a1d31",
            fontWeight: 700,
            fontSize: 12.5,
            cursor: loading ? "wait" : "pointer",
            boxShadow: "0 10px 20px rgba(0,0,0,0.08)",
          }}
        >
          {loading ? "Cargando..." : "Seleccionar archivo"}
        </button>
        <button
          type="button"
          onClick={onClose}
          style={{
            padding: "11px 12px",
            borderRadius: 14,
            border: "1px solid rgba(0,0,0,0.08)",
            background: "rgba(255,255,255,0.8)",
            color: "#505050",
            fontWeight: 700,
            fontSize: 12.5,
            cursor: "pointer",
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
