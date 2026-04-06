"use client";
import React from "react";
import { getLegendItems } from "@/data/legendCatalog";

const normalize = (s) => String(s || "").trim().toLowerCase();

/**
 * legends: Array<{ legendKey, title, filterTexts?:string[], extras?:Array<{color,text}> }>
 * filterTexts: los legendItem activos (texto) para ese legendKey.
 */
export default function LegendDock({ legends = [] }) {
  if (!Array.isArray(legends) || legends.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        right: 12,
        bottom: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        maxHeight: "60vh",
        overflowY: "auto",
        zIndex: 9999,
      }}
    >
      {legends.map((g) => {
        const key = g.legendKey || g.key || g.id;
        const base = getLegendItems(key);

        // Normalizamos filtros (legendItem) para comparar por texto
        const filters = (g.filterTexts || []).map(normalize);

        // Si hay filtros => solo esos; si no, todos
        let items = filters.length
          ? base.filter((it) => filters.includes(normalize(it.text)))
          : base.slice(); // copia

        // Merge con extras (si existen) y dedupe por texto normalizado
        const extra = Array.isArray(g.extras) ? g.extras : [];
        const merged = new Map();
        [...items, ...extra].forEach((it) => {
          if (!it || !it.text) return;
          const k = normalize(it.text);
          if (!merged.has(k)) merged.set(k, it);
        });
        items = Array.from(merged.values());

        return (
          <div
            key={key}
            style={{
              background: "rgba(255,255,255,0.86)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 12,
              boxShadow: "0 10px 28px rgba(0,0,0,.12)",
              padding: "10px 12px",
              minWidth: 220,
              maxWidth: 340,
            }}
          >
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
  );
}
