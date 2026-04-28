import Link from "next/link";
import styles from "./RepositoryTeaser.module.css";

const rows = [
  {
    place: "Pachuca de Soto",
    group: "PMDU",
    detail: "Etapas de Crecimiento",
    pdf: "https://imip.pachuca.gob.mx/historico/docs/Programas/Programa%20Municipal%20de%20Desarrollo%20Urbano/PMDU_PACHUCA.pdf",
  },
  {
    place: "Tizayuca",
    group: "PMDU",
    detail: "Zonificación Secundaria",
    pdf: "https://www.tizayuca.gob.mx/Transparencia/IMDUyV/Articulo70/IncisoF/ORDENAMIENTOTERRITORIAL/PROGRAMAMUNICIPALDESARROLLOURBANOYORDENAMIENTOTERRITORIAL.pdf",
  },
  {
    place: "Zonas Metropolitanas",
    group: "Información básica",
    detail: "ZMVM, Pachuca, Tula",
    pdf: "https://epazoyucan.hidalgo.gob.mx/descargables/transparencia/Fracciones/30/Obras/PDUyOT_ZM_PACHUCA.pdf",
  },
];

const formats = ["GeoJSON", "SHP", "CSV"];

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13 3v9.2l3.6-3.6L18 10l-6 6-6-6 1.4-1.4 3.6 3.6V3h2Zm-8 14h2v2h10v-2h2v4H5v-4Z" />
    </svg>
  );
}

export default function RepositoryTeaser() {
  return (
    <section id="instrumentos" className={styles.section} aria-labelledby="repository-title">
      <div className={styles.panel}>
        <div className={styles.panelHeader}>
          <span>Repositorio</span>
          <strong>Instrumentos de Planeación</strong>
        </div>
        <div className={styles.rows}>
          {rows.map(({ place, group, detail, pdf }) => (
            <article key={`${place}-${detail}`} className={styles.row}>
              <div>
                <strong>{place}</strong>
                <span>{group}</span>
              </div>
              <p>{detail}</p>
              <a href={pdf} target="_blank" rel="noopener noreferrer" aria-label={`Descargar PDF de ${detail}`}>
                <DownloadIcon />
              </a>
            </article>
          ))}
        </div>
      </div>

      <div className={styles.copy}>
        <p>Descarga de datos</p>
        <h2 id="repository-title">Repositorio de Instrumentos de Planeación</h2>
        <span>
          Consulta instrumentos municipales y metropolitanos. Cada registro descarga su documento PDF correspondiente para revisión normativa y planeación territorial.
        </span>
        <div className={styles.formats} aria-label="Formatos disponibles">
          {formats.map((format) => (
            <b key={format}>{format}</b>
          ))}
        </div>
        <Link href="/repositorio">
          Ir al repositorio
          <DownloadIcon />
        </Link>
      </div>
    </section>
  );
}
