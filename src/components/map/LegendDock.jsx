"use client";
import React, { useMemo, useState } from "react";
import { getLegendItems } from "@/data/legendCatalog";

const normalize = (s) => String(s || "").trim().toLowerCase();
const panelStyle = {
  background: "rgba(255,255,255,0.9)",
  backdropFilter: "blur(10px)",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 16,
  boxShadow: "0 12px 28px rgba(0,0,0,.14)",
  minWidth: 260,
  maxWidth: 360,
  overflow: "hidden",
};

function ChevronIcon({ open }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={open ? "M7 14l5-5 5 5" : "M7 10l5 5 5-5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LegendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="7" cy="7" r="3" fill="currentColor" />
      <circle cx="7" cy="17" r="3" fill="currentColor" opacity="0.7" />
      <rect x="12" y="6" width="8" height="2" rx="1" fill="currentColor" />
      <rect x="12" y="16" width="8" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 4l8 4-8 4-8-4 8-4zm-8 8l8 4 8-4m-16 4l8 4 8-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Section({ title, icon, defaultOpen = true, children, subtitle = null }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={panelStyle}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          padding: "12px 14px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "#202020",
          textAlign: "left",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ display: "inline-flex", color: "#7a1d31" }}>{icon}</span>
          <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <strong style={{ fontSize: 13 }}>{title}</strong>
            {subtitle ? <span style={{ fontSize: 11.5, color: "#666" }}>{subtitle}</span> : null}
          </span>
        </span>
        <span style={{ color: "#555" }}>
          <ChevronIcon open={open} />
        </span>
      </button>
      {open ? (
        <div
          style={{
            padding: "0 14px 14px",
            maxHeight: "34vh",
            overflowY: "auto",
            overscrollBehavior: "contain",
            scrollbarGutter: "stable",
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

/**
 * legends: Array<{ legendKey, title, filterTexts?:string[], extras?:Array<{color,text}> }>
 * filterTexts: los legendItem activos (texto) para ese legendKey.
 */
export default function LegendDock({
  legends = [],
  activeLayers = [],
  layerOpacityMap = {},
  onLayerOpacityChange = () => {},
  onManyLayerOpacityChange = () => {},
  style = {},
}) {
  const hasLegends = Array.isArray(legends) && legends.length > 0;
  const hasActiveLayers = Array.isArray(activeLayers) && activeLayers.length > 0;

  const activeCatalogs = useMemo(() => {
    const groups = new Map();

    activeLayers.forEach((layer) => {
      const path = Array.isArray(layer.groupPath) ? layer.groupPath : [];
      const key = path[0] || "Capas sueltas";
      const current = groups.get(key);

      if (current) {
        current.layers.push(layer);
      } else {
        groups.set(key, { key, title: key, layers: [layer] });
      }
    });

    return Array.from(groups.values()).map((group) => {
      const opacities = group.layers.map((layer) => Number(layerOpacityMap[layer.id] ?? 1));
      const averageOpacity = opacities.length
        ? opacities.reduce((sum, value) => sum + value, 0) / opacities.length
        : 1;

      return {
        ...group,
        averageOpacity,
      };
    });
  }, [activeLayers, layerOpacityMap]);

  if (!hasLegends && !hasActiveLayers) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxHeight: "60vh",
        overflowY: "auto",
        zIndex: 9999,
        ...style,
      }}
    >
      {hasLegends && (
        <Section
          title="Simbología"
          icon={<LegendIcon />}
          subtitle={`${legends.length} bloque${legends.length === 1 ? "" : "s"} activo${legends.length === 1 ? "" : "s"}`}
        >
          <div style={{ display: "grid", gap: 10 }}>
            {legends.map((g) => {
              const key = g.legendKey || g.key || g.id;
              const base = getLegendItems(key);
              const filters = (g.filterTexts || []).map(normalize);

              let items = filters.length
                ? base.filter((it) => filters.includes(normalize(it.text)))
                : base.slice();

              const extra = Array.isArray(g.extras) ? g.extras : [];
              const merged = new Map();
              [...items, ...extra].forEach((it) => {
                if (!it || !it.text) return;
                const mergedKey = normalize(it.text);
                if (!merged.has(mergedKey)) merged.set(mergedKey, it);
              });
              items = Array.from(merged.values());

              return (
                <div key={key} style={{ borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 10 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: 13,
                      color: "#222",
                      marginBottom: 6,
                      lineHeight: 1.2,
                    }}
                  >
                    {g.title || key}
                  </div>

                  {items.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#666" }}>Sin elementos seleccionados</div>
                  ) : (
                    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 6 }}>
                      {items.map((it, idx) => (
                        <li key={`${key}-${idx}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            aria-hidden
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: "50%",
                              background: it.color || "#999",
                              border: "1px solid rgba(0,0,0,.15)",
                              flex: "0 0 14px",
                            }}
                          />
                          <span style={{ fontSize: 12.5, color: "#2b2b2b" }}>{it.text}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {hasActiveLayers && (
        <Section
          title="Capas activas"
          icon={<LayersIcon />}
          subtitle={`${activeLayers.length} capa${activeLayers.length === 1 ? "" : "s"} visible${activeLayers.length === 1 ? "" : "s"}`}
        >
          <div style={{ display: "grid", gap: 12 }}>
            {activeCatalogs.map((catalog) => (
              <div
                key={catalog.key}
                style={{
                  paddingBottom: 10,
                  borderBottom: "1px solid rgba(0,0,0,0.06)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                  <div>
                    <strong style={{ display: "block", fontSize: 12.5, color: "#222" }}>{catalog.title}</strong>
                    <span style={{ fontSize: 11.5, color: "#666" }}>
                      {catalog.layers.length} capa{catalog.layers.length === 1 ? "" : "s"}
                    </span>
                  </div>
                  <span style={{ fontSize: 11.5, color: "#666" }}>
                    {Math.round(catalog.averageOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={Math.round(catalog.averageOpacity * 100)}
                  onChange={(event) =>
                    onManyLayerOpacityChange(
                      catalog.layers.map((layer) => layer.id),
                      Number(event.target.value) / 100
                    )
                  }
                  style={{ width: "100%" }}
                />
              </div>
            ))}

            <div style={{ display: "grid", gap: 10 }}>
              {activeLayers.map((layer) => {
                const path = Array.isArray(layer.groupPath) ? layer.groupPath.join(" / ") : "";
                const opacity = Number(layerOpacityMap[layer.id] ?? 1);

                return (
                  <div
                    key={layer.id}
                    style={{
                      padding: "10px 0 0",
                      borderTop: "1px solid rgba(0,0,0,0.06)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginBottom: 6 }}>
                      <div>
                        <strong style={{ display: "block", fontSize: 12.5, color: "#222" }}>{layer.name}</strong>
                        {path ? <span style={{ fontSize: 11.5, color: "#666" }}>{path}</span> : null}
                      </div>
                      <span style={{ fontSize: 11.5, color: "#666" }}>{Math.round(opacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={Math.round(opacity * 100)}
                      onChange={(event) => onLayerOpacityChange(layer.id, Number(event.target.value) / 100)}
                      style={{ width: "100%" }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </Section>
      )}
    </div>
  );
}
