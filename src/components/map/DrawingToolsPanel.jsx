"use client";

const TOOL_BUTTONS = [
  {
    id: "point",
    label: "Punto",
    hint: "Marca una ubicación puntual.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 21s5.6-4.8 5.6-10.2a5.6 5.6 0 10-11.2 0C6.4 16.2 12 21 12 21zm0-7.6a2 2 0 110-4 2 2 0 010 4z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    id: "line",
    label: "Línea",
    hint: "Traza una ruta o eje lineal.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 18L19 6" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
        <circle cx="5" cy="18" r="2.2" fill="currentColor" />
        <circle cx="19" cy="6" r="2.2" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "polygon",
    label: "Polígono",
    hint: "Une puntos para cerrar un área irregular.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M6 8l5-4 6 3 1 7-6 5-7-3-1-6z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "rectangle",
    label: "Rectángulo",
    hint: "Define dos esquinas opuestas.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="7" width="14" height="10" rx="1.8" fill="none" stroke="currentColor" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: "circle",
    label: "Círculo",
    hint: "Marca centro y radio.",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="6.6" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="12" cy="12" r="1.4" fill="currentColor" />
      </svg>
    ),
  },
];

export default function DrawingToolsPanel({
  open,
  activeTool,
  hasSession,
  canFinish,
  measurementText,
  helperText,
  featureCount,
  features = [],
  editingFeatureId = null,
  onClose,
  onSelectTool,
  onFinish,
  onCancel,
  onClear,
  onDownloadKml,
  onEditFeature,
  onDeleteFeature,
  onSaveEdit,
  onCancelEdit,
}) {
  if (!open) return null;

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      style={{
        position: "absolute",
        top: 154,
        left: 54,
        bottom: 18,
        zIndex: 20006,
        width: 318,
        padding: "14px 14px 18px",
        borderRadius: 18,
        background: "rgba(255,255,255,0.96)",
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 18px 38px rgba(0,0,0,0.18)",
        backdropFilter: "blur(14px)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "grid", gap: 3 }}>
          <strong style={{ fontSize: 13, color: "#202020" }}>Herramientas de dibujo</strong>
          <span style={{ fontSize: 11.5, color: "#666" }}>Traza figuras y descarga el resultado en KML</span>
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
          flex: 1,
          minHeight: 0,
          display: "grid",
          gap: 12,
          overflowY: "auto",
          paddingRight: 6,
          paddingBottom: 10,
          scrollbarGutter: "stable",
        }}
      >
        <div style={{ display: "grid", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#7a1d31", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>
            Trazos disponibles
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
            {TOOL_BUTTONS.map((tool) => {
              const selected = activeTool === tool.id;
              return (
                <button
                  key={tool.id}
                  type="button"
                  onClick={() => onSelectTool(tool.id)}
                  style={{
                    display: "grid",
                    gap: 6,
                    justifyItems: "start",
                    padding: "10px 11px",
                    borderRadius: 14,
                    border: selected ? "1px solid rgba(122,29,49,0.28)" : "1px solid rgba(0,0,0,0.08)",
                    background: selected
                      ? "linear-gradient(135deg, rgba(122,29,49,0.08), rgba(188,149,91,0.18))"
                      : "linear-gradient(135deg, rgba(255,255,255,0.95), rgba(248,245,240,0.95))",
                    color: selected ? "#7a1d31" : "#3a3a3a",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: selected ? "rgba(255,255,255,0.7)" : "rgba(122,29,49,0.06)",
                    }}
                  >
                    {tool.icon}
                  </span>
                  <span style={{ display: "grid", gap: 2 }}>
                    <strong style={{ fontSize: 12.5 }}>{tool.label}</strong>
                    <span style={{ fontSize: 10.8, color: selected ? "#7a1d31" : "#666", lineHeight: 1.35 }}>{tool.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ height: 1, background: "linear-gradient(90deg, rgba(122,29,49,0.12), rgba(188,149,91,0.22), rgba(122,29,49,0.04))" }} />

        <div style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 11, color: "#7a1d31", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>
            Estado del trazo
          </span>
          <span style={{ fontSize: 12.5, color: "#2e2e2e", lineHeight: 1.5 }}>
            {helperText || "Elige una herramienta y comienza a dibujar sobre el mapa."}
          </span>
          <span style={{ fontSize: 12, color: "#5b5555" }}>
            {measurementText || "Las mediciones aparecerán aquí mientras trazas y cuando cierres la figura."}
          </span>
          <span style={{ fontSize: 11.5, color: "#7a1d31", fontWeight: 700 }}>
            Elementos creados: {featureCount}
          </span>
        </div>

        {features.length > 0 ? (
          <>
            <div style={{ height: 1, background: "linear-gradient(90deg, rgba(122,29,49,0.12), rgba(188,149,91,0.22), rgba(122,29,49,0.04))" }} />
            <div style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 11, color: "#7a1d31", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em" }}>
                Elementos creados
              </span>
              <div style={{ display: "grid", gap: 8 }}>
                {features.map((feature) => {
                  const editing = editingFeatureId === feature.id;
                  return (
                    <div
                      key={feature.id}
                      style={{
                        display: "grid",
                        gap: 8,
                        padding: "10px 11px",
                        borderRadius: 14,
                        background: editing
                          ? "linear-gradient(135deg, rgba(122,29,49,0.08), rgba(188,149,91,0.18))"
                          : "linear-gradient(135deg, rgba(255,255,255,0.96), rgba(248,245,240,0.96))",
                        border: editing ? "1px solid rgba(122,29,49,0.22)" : "1px solid rgba(0,0,0,0.08)",
                      }}
                    >
                      <div style={{ display: "grid", gap: 2 }}>
                        <strong style={{ fontSize: 12.5, color: "#202020" }}>{feature.label}</strong>
                        <span style={{ fontSize: 11, color: editing ? "#7a1d31" : "#666" }}>{feature.typeLabel}</span>
                        <span style={{ fontSize: 11.5, color: "#3c3c3c", lineHeight: 1.4 }}>{feature.summary || "Sin mediciones disponibles"}</span>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {editing ? (
                          <>
                            <button
                              type="button"
                              onClick={onSaveEdit}
                              style={{
                                flex: 1,
                                padding: "8px 10px",
                                borderRadius: 12,
                                border: "1px solid rgba(122,29,49,0.14)",
                                background: "rgba(255,255,255,0.78)",
                                color: "#7a1d31",
                                fontWeight: 700,
                                fontSize: 11.8,
                                cursor: "pointer",
                              }}
                            >
                              Guardar
                            </button>
                            <button
                              type="button"
                              onClick={onCancelEdit}
                              style={{
                                flex: 1,
                                padding: "8px 10px",
                                borderRadius: 12,
                                border: "1px solid rgba(0,0,0,0.08)",
                                background: "rgba(255,255,255,0.78)",
                                color: "#505050",
                                fontWeight: 700,
                                fontSize: 11.8,
                                cursor: "pointer",
                              }}
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => onEditFeature(feature.id)}
                              style={{
                                flex: 1,
                                padding: "8px 10px",
                                borderRadius: 12,
                                border: "1px solid rgba(122,29,49,0.14)",
                                background: "rgba(255,255,255,0.78)",
                                color: "#7a1d31",
                                fontWeight: 700,
                                fontSize: 11.8,
                                cursor: "pointer",
                              }}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteFeature(feature.id)}
                              style={{
                                flex: 1,
                                padding: "8px 10px",
                                borderRadius: 12,
                                border: "1px solid rgba(0,0,0,0.08)",
                                background: "rgba(255,255,255,0.78)",
                                color: "#505050",
                                fontWeight: 700,
                                fontSize: 11.8,
                                cursor: "pointer",
                              }}
                            >
                              Eliminar
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}
      </div>

      <div
        style={{
          display: "grid",
          gap: 10,
          marginTop: "auto",
          paddingTop: 12,
          borderTop: "1px solid rgba(122,29,49,0.08)",
          background: "linear-gradient(180deg, rgba(255,255,255,0), rgba(255,255,255,0.96) 36%)",
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8 }}>
          <button
            type="button"
            disabled={!canFinish}
            onClick={onFinish}
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(122,29,49,0.14)",
              background: canFinish
                ? "linear-gradient(135deg, rgba(122,29,49,0.08), rgba(188,149,91,0.18))"
                : "rgba(0,0,0,0.05)",
              color: canFinish ? "#7a1d31" : "#8f8f8f",
              fontWeight: 700,
              fontSize: 12.5,
              cursor: canFinish ? "pointer" : "not-allowed",
            }}
          >
            Finalizar
          </button>
          <button
            type="button"
            disabled={!hasSession}
            onClick={onCancel}
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.08)",
              background: hasSession ? "rgba(255,255,255,0.88)" : "rgba(0,0,0,0.04)",
              color: hasSession ? "#505050" : "#8f8f8f",
              fontWeight: 700,
              fontSize: 12.5,
              cursor: hasSession ? "pointer" : "not-allowed",
            }}
          >
            Cancelar trazo
          </button>
          <button
            type="button"
            disabled={featureCount === 0}
            onClick={onDownloadKml}
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(122,29,49,0.14)",
              background: featureCount > 0
                ? "linear-gradient(135deg, rgba(105,27,50,0.09), rgba(188,149,91,0.22))"
                : "rgba(0,0,0,0.05)",
              color: featureCount > 0 ? "#691b32" : "#8f8f8f",
              fontWeight: 700,
              fontSize: 12.5,
              cursor: featureCount > 0 ? "pointer" : "not-allowed",
            }}
          >
            Descargar KML
          </button>
          <button
            type="button"
            disabled={featureCount === 0}
            onClick={onClear}
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(0,0,0,0.08)",
              background: featureCount > 0 ? "rgba(255,255,255,0.88)" : "rgba(0,0,0,0.04)",
              color: featureCount > 0 ? "#505050" : "#8f8f8f",
              fontWeight: 700,
              fontSize: 12.5,
              cursor: featureCount > 0 ? "pointer" : "not-allowed",
            }}
          >
            Limpiar todo
          </button>
        </div>
      </div>
    </div>
  );
}
