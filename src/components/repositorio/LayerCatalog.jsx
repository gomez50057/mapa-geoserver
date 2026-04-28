"use client";

import { useMemo, useState } from "react";
import styles from "./LayerCatalog.module.css";

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13 3v9.2l3.6-3.6L18 10l-6 6-6-6 1.4-1.4 3.6 3.6V3h2Zm-8 14h2v2h10v-2h2v4H5v-4Z" />
    </svg>
  );
}

export default function LayerCatalog({ catalog }) {
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState("Todas");
  const [municipality, setMunicipality] = useState("Todos");

  const filteredLayers = useMemo(() => {
    const normalizedQuery = normalize(query);

    return catalog.layers.filter((layer) => {
      const text = normalize(`${layer.name} ${layer.collection} ${layer.municipality} ${layer.program} ${layer.groupPath}`);
      const matchesQuery = !normalizedQuery || text.includes(normalizedQuery);
      const matchesCollection = collection === "Todas" || layer.collection === collection;
      const matchesMunicipality = municipality === "Todos" || layer.municipality === municipality;
      return matchesQuery && matchesCollection && matchesMunicipality;
    });
  }, [catalog.layers, collection, municipality, query]);

  return (
    <section className={styles.catalog} aria-labelledby="catalog-title">
      <div className={styles.heading}>
        <div>
          <p>Catálogo descargable</p>
          <h2 id="catalog-title">Capas disponibles</h2>
        </div>
        <span>{filteredLayers.length} resultados</span>
      </div>

      <div className={styles.controls}>
        <label>
          <span>Buscar</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre, municipio o programa"
          />
        </label>
        <label>
          <span>Colección</span>
          <select value={collection} onChange={(event) => setCollection(event.target.value)}>
            <option>Todas</option>
            {catalog.collections.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Municipio o ámbito</span>
          <select value={municipality} onChange={(event) => setMunicipality(event.target.value)}>
            <option>Todos</option>
            {catalog.municipalities.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.list}>
        {filteredLayers.map((layer) => (
          <article className={styles.card} key={layer.id}>
            <div className={styles.meta}>
              <span>{layer.collection}</span>
              <b>{layer.geometryType}</b>
            </div>
            <h3>{layer.name}</h3>
            <p>{layer.groupPath}</p>
            <small>{layer.typeName}</small>
            <div className={styles.downloads}>
              {layer.downloads.map((download) => (
                <a key={download.key} href={download.href} title={download.title}>
                  <DownloadIcon />
                  {download.label}
                </a>
              ))}
            </div>
          </article>
        ))}
      </div>

      {filteredLayers.length === 0 ? (
        <div className={styles.empty}>
          <strong>Sin resultados</strong>
          <span>Prueba con otro municipio, programa o colección.</span>
        </div>
      ) : null}
    </section>
  );
}
