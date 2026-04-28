"use client";

import React, { useEffect, useRef } from "react";

export default function MapSearchBar({
  mode = "map",
  onModeChange = () => {},
  layerQuery = "",
  layerResultCount = 0,
  onLayerQueryChange = () => {},
  onLayerClear = () => {},
  query = "",
  loading = false,
  open = false,
  expanded = false,
  results = [],
  message = "",
  highlightedIndex = -1,
  onQueryChange = () => {},
  onHighlightChange = () => {},
  onSelectResult = () => {},
  onClear = () => {},
  onClose = () => {},
  onExpand = () => {},
}) {
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!expanded) return undefined;
    const timeoutId = window.setTimeout(() => {
      inputRef.current?.focus?.();
    }, 25);
    return () => window.clearTimeout(timeoutId);
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return undefined;

    const handlePointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [expanded, onClose]);

  const isLayerMode = mode === "layers";
  const activeQuery = isLayerMode ? layerQuery : query;
  const hasValue = activeQuery.trim().length > 0;
  const showResults = !isLayerMode && open && (loading || results.length > 0 || message);

  if (!expanded) {
    return (
      <div
        ref={wrapperRef}
        style={{
          position: "absolute",
          top: 16,
          left: "50%",
          transform: "translateX(-38%)",
          zIndex: 20012,
          pointerEvents: "auto",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onExpand}
          aria-label="Abrir buscador del mapa"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            minHeight: 46,
            padding: "0 14px",
            border: "1px solid rgba(255,255,255,0.55)",
            borderRadius: 18,
            background: "rgba(255,255,255,0.94)",
            boxShadow: "0 20px 42px rgba(0,0,0,0.18)",
            backdropFilter: "blur(14px)",
            color: "#7a1d31",
            cursor: "pointer",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center" }} aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                d="M11 4a7 7 0 105.15 11.74l4.05 4.06 1.4-1.4-4.06-4.05A7 7 0 0011 4zm0 2a5 5 0 110 10 5 5 0 010-10z"
                fill="currentColor"
              />
            </svg>
          </span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: "#202020" }}>Buscar</span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      style={{
        position: "absolute",
        top: 16,
        left: "50%",
        transform: "translateX(-38%)",
        width: "min(460px, calc(100vw - 180px))",
        zIndex: 20012,
        pointerEvents: "auto",
      }}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        style={{
          display: "grid",
          gap: 10,
          padding: "12px 14px",
          borderRadius: 18,
          background: "rgba(255,255,255,0.94)",
          border: "1px solid rgba(255,255,255,0.55)",
          boxShadow: "0 20px 42px rgba(0,0,0,0.18)",
          backdropFilter: "blur(14px)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: 4,
            borderRadius: 16,
            background: "rgba(122,29,49,0.06)",
            border: "1px solid rgba(122,29,49,0.08)",
            width: "fit-content",
          }}
        >
          {[
            { id: "layers", label: "Capas" },
            { id: "map", label: "Mapa" },
          ].map((item) => {
            const active = mode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onModeChange(item.id)}
                aria-pressed={active}
                style={{
                  minHeight: 34,
                  padding: "0 14px",
                  border: "none",
                  borderRadius: 12,
                  background: active
                    ? "linear-gradient(135deg, rgba(122,29,49,0.92), rgba(153,75,99,0.92))"
                    : "transparent",
                  color: active ? "#fff" : "#6b5d5d",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "background 140ms ease, color 140ms ease, transform 140ms ease",
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            minHeight: 44,
            borderRadius: 14,
            background: "rgba(255,255,255,0.72)",
            border: "1px solid rgba(0,0,0,0.08)",
            padding: "0 10px 0 12px",
          }}
        >
          <span style={{ color: "#7a1d31", display: "inline-flex", alignItems: "center" }} aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                d="M11 4a7 7 0 105.15 11.74l4.05 4.06 1.4-1.4-4.06-4.05A7 7 0 0011 4zm0 2a5 5 0 110 10 5 5 0 010-10z"
                fill="currentColor"
              />
            </svg>
          </span>
          <input
            ref={inputRef}
            type="text"
            value={activeQuery}
            onChange={(event) => {
              if (isLayerMode) {
                onLayerQueryChange(event.target.value);
              } else {
                onQueryChange(event.target.value);
                if (!open) onHighlightChange(-1);
              }
            }}
            onFocus={() => {
              if (!isLayerMode) onHighlightChange(results.length ? 0 : -1);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                if (hasValue) {
                  if (isLayerMode) onLayerClear();
                  else onClear();
                }
                else onClose();
                return;
              }

              if (isLayerMode) return;
              if (!results.length) return;

              if (event.key === "ArrowDown") {
                event.preventDefault();
                onHighlightChange((highlightedIndex + 1) % results.length);
              }

              if (event.key === "ArrowUp") {
                event.preventDefault();
                onHighlightChange((highlightedIndex - 1 + results.length) % results.length);
              }

              if (event.key === "Enter" && highlightedIndex >= 0) {
                event.preventDefault();
                onSelectResult(results[highlightedIndex]);
              }
            }}
            placeholder={isLayerMode ? "Buscar capas o grupos" : "Buscar lugares, calles o coordenadas"}
            aria-label={isLayerMode ? "Buscar capas o grupos" : "Buscar lugares, calles o coordenadas"}
            style={{
              flex: 1,
              minWidth: 0,
              height: 42,
              border: "none",
              background: "transparent",
              outline: "none",
              fontSize: 13,
              color: "#202020",
            }}
          />
          {loading ? (
            <span style={{ fontSize: 11.5, color: "#666", whiteSpace: "nowrap" }}>Buscando...</span>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            aria-label="Minimizar buscador del mapa"
            title="Minimizar"
            style={{
              width: 30,
              height: 30,
              border: "none",
              borderRadius: 10,
              background: "rgba(122,29,49,0.08)",
              color: "#7a1d31",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M7 10l5 5 5-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          {hasValue ? (
            <button
              type="button"
              onClick={isLayerMode ? onLayerClear : onClear}
              aria-label={isLayerMode ? "Limpiar búsqueda de capas" : "Limpiar búsqueda"}
              style={{
                width: 30,
                height: 30,
                border: "none",
                borderRadius: 10,
                background: "rgba(122,29,49,0.08)",
                color: "#7a1d31",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24">
                <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          ) : null}
        </div>

        <div style={{ fontSize: 11.5, color: "#6a6565", lineHeight: 1.4 }}>
          {isLayerMode
            ? hasValue
              ? `${layerResultCount} coincidencia${layerResultCount === 1 ? "" : "s"} en el catálogo activo.`
              : "Filtra el catálogo por nombre de capa o grupo."
            : "Búsqueda limitada a Ciudad de México, Estado de México, Hidalgo y Morelos."}
        </div>

        {showResults ? (
          <div
            style={{
              display: "grid",
              gap: 6,
              maxHeight: 300,
              overflowY: "auto",
              paddingRight: 4,
            }}
          >
            {results.map((result, index) => {
              const highlighted = index === highlightedIndex;
              return (
                <button
                  key={result.id}
                  type="button"
                  onMouseEnter={() => onHighlightChange(index)}
                  onClick={() => onSelectResult(result)}
                  style={{
                    width: "100%",
                    display: "grid",
                    gap: 3,
                    padding: "10px 12px",
                    borderRadius: 14,
                    border: highlighted ? "1px solid rgba(122,29,49,0.22)" : "1px solid rgba(0,0,0,0.08)",
                    background: highlighted
                      ? "linear-gradient(135deg, rgba(122,29,49,0.08), rgba(188,149,91,0.16))"
                      : "rgba(255,255,255,0.76)",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <strong style={{ fontSize: 12.5, color: "#202020" }}>{result.label}</strong>
                  {result.secondaryLabel ? (
                    <span style={{ fontSize: 11.5, color: "#666" }}>{result.secondaryLabel}</span>
                  ) : null}
                </button>
              );
            })}
            {!results.length && message ? (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: 14,
                  background: "rgba(255,255,255,0.76)",
                  border: "1px solid rgba(0,0,0,0.08)",
                  fontSize: 12,
                  color: "#5b5555",
                  lineHeight: 1.45,
                }}
              >
                {message}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
