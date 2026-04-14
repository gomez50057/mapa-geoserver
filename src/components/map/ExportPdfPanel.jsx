import React from "react";
import { EXPORT_PAGE_PRESETS } from "./utils/exportPdfUtils";

export default function ExportPdfPanel({
  open,
  loading,
  error,
  paperSize,
  importPanelOpen,
  onClose,
  onPaperChange,
  onExport,
}) {
  if (!open) return null;

  return (
    <div
      data-export-ignore="true"
      onClick={(event) => event.stopPropagation()}
      style={{
        position: "absolute",
        top: importPanelOpen ? 344 : 108,
        left: 54,
        zIndex: 20007,
        width: 318,
        padding: 14,
        borderRadius: 18,
        background: "rgba(255,255,255,0.96)",
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 18px 38px rgba(0,0,0,0.18)",
        backdropFilter: "blur(14px)",
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "grid", gap: 3 }}>
          <strong style={{ fontSize: 13, color: "#202020" }}>Descargar mapa</strong>
          <span style={{ fontSize: 11.5, color: "#666" }}>Incluye mapa visible y simbología en PDF</span>
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

      <div style={{ display: "grid", gap: 8 }}>
        <span style={{ fontSize: 11, color: "#7a1d31", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>
          Tamaño de salida
        </span>
        <div style={{ display: "grid", gap: 8 }}>
          {Object.entries(EXPORT_PAGE_PRESETS).map(([key, preset]) => {
            const selected = paperSize === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onPaperChange(key)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: selected ? "1px solid rgba(122,29,49,0.28)" : "1px solid rgba(0,0,0,0.08)",
                  background: selected
                    ? "linear-gradient(135deg, rgba(122,29,49,0.08), rgba(188,149,91,0.18))"
                    : "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(248,245,240,0.95))",
                  color: "#2a2a2a",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ display: "grid", gap: 2 }}>
                  <strong style={{ fontSize: 12.5 }}>{preset.label}</strong>
                  <span style={{ fontSize: 11.5, color: "#666" }}>Horizontal, listo para guardar como PDF</span>
                </span>
                <span
                  aria-hidden
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    border: selected ? "5px solid #7a1d31" : "2px solid rgba(122,29,49,0.24)",
                    background: selected ? "#f7f1ea" : "transparent",
                    flex: "0 0 18px",
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gap: 4 }}>
        <span style={{ fontSize: 11.5, color: "#666", lineHeight: 1.45 }}>
          Si la simbología no cabe en la primera hoja, se agrega una segunda.
        </span>
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
          onClick={onExport}
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
          {loading ? "Preparando..." : "Descargar PDF"}
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
