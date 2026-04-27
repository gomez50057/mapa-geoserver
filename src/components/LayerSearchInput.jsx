"use client";

import React from "react";
import styles from "./LayerTree.module.css";

export default function LayerSearchInput({
  value = "",
  resultCount = 0,
  onChange = () => {},
  onClear = () => {},
}) {
  const hasValue = value.trim().length > 0;

  return (
    <div className={styles.searchShell}>
      <div className={styles.searchInputWrap}>
        <span className={styles.searchIcon} aria-hidden="true">
          <svg width="15" height="15" viewBox="0 0 24 24">
            <path
              d="M11 4a7 7 0 105.15 11.74l4.05 4.06 1.4-1.4-4.06-4.05A7 7 0 0011 4zm0 2a5 5 0 110 10 5 5 0 010-10z"
              fill="currentColor"
            />
          </svg>
        </span>
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && hasValue) {
              event.preventDefault();
              onClear();
            }
          }}
          placeholder="Buscar capas o grupos"
          className={styles.searchInput}
          aria-label="Buscar capas o grupos"
        />
        {hasValue ? (
          <button
            type="button"
            onClick={onClear}
            className={styles.searchClear}
            aria-label="Limpiar búsqueda"
            title="Limpiar búsqueda"
          >
            <svg width="14" height="14" viewBox="0 0 24 24">
              <path
                d="M6 6l12 12M18 6L6 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ) : null}
      </div>
      {hasValue ? (
        <div className={styles.searchMeta}>
          {resultCount > 0 ? `${resultCount} capa${resultCount === 1 ? "" : "s"} encontrada${resultCount === 1 ? "" : "s"}` : "Sin coincidencias"}
        </div>
      ) : null}
    </div>
  );
}
