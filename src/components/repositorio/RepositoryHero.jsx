import styles from "./RepositoryHero.module.css";

function DatabaseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2C7 2 3 3.8 3 6v12c0 2.2 4 4 9 4s9-1.8 9-4V6c0-2.2-4-4-9-4Zm0 2c4.4 0 7 1.5 7 2s-2.6 2-7 2-7-1.5-7-2 2.6-2 7-2ZM5 8.8c1.6.8 4.1 1.2 7 1.2s5.4-.4 7-1.2V12c0 .5-2.6 2-7 2s-7-1.5-7-2V8.8Zm0 6c1.6.8 4.1 1.2 7 1.2s5.4-.4 7-1.2V18c0 .5-2.6 2-7 2s-7-1.5-7-2v-3.2Z" />
    </svg>
  );
}

export default function RepositoryHero({ stats, formats }) {
  return (
    <section className={styles.hero} aria-labelledby="repository-hero-title">
      <div className={styles.copy}>
        <p>Repositorio de capas</p>
        <h1 id="repository-hero-title">Instrumentos de Planeación listos para descargar.</h1>
        <span>
          Consulta el catálogo del Mapa Digital y descarga capas en formatos prácticos para flujos SIG, análisis territorial y revisión institucional.
        </span>
      </div>

      <div className={styles.summary} aria-label="Resumen del repositorio">
        <div className={styles.icon}>
          <DatabaseIcon />
        </div>
        <div className={styles.stats}>
          <strong>{stats.layers}</strong>
          <span>Capas disponibles</span>
        </div>
        <div className={styles.stats}>
          <strong>{stats.collections}</strong>
          <span>Colecciones</span>
        </div>
        <div className={styles.formats}>
          {formats.map((format) => (
            <b key={format.key}>{format.label}</b>
          ))}
        </div>
      </div>
    </section>
  );
}
