import Link from "next/link";
import styles from "./HeroSection.module.css";

const layerTags = ["PMDU", "Zonas metropolitanas", "Municipios", "Equipamiento"];

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13.8 5.3 20.5 12l-6.7 6.7-1.4-1.4 4.3-4.3H4v-2h12.7l-4.3-4.3 1.4-1.4Z" />
    </svg>
  );
}

export default function HeroSection() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.visual} aria-hidden="true">
        <div className={styles.mapLines} />
        <div className={`${styles.zone} ${styles.zoneOne}`} />
        <div className={`${styles.zone} ${styles.zoneTwo}`} />
        <div className={`${styles.zone} ${styles.zoneThree}`} />
        <div className={`${styles.pin} ${styles.pinOne}`} />
        <div className={`${styles.pin} ${styles.pinTwo}`} />
        <div className={styles.floatingPanel}>
          <span>Capas activas</span>
          <strong>Instrumentos de Planeación</strong>
          <small>Consulta territorial integrada</small>
        </div>
      </div>

      <div className={styles.copy}>
        <p className={styles.kicker}>Geoinformación para Hidalgo</p>
        <h1 id="hero-title">Mapa Digital Regional y Metropolitano</h1>
        <p className={styles.lead}>
          Consulta capas urbanas, metropolitanas y de planeación en un visor cartográfico diseñado para explorar el territorio con contexto técnico y descarga de datos.
        </p>
        <div className={styles.actions}>
          <Link href="/mapa" className={styles.primary}>
            Entrar al mapa
            <ArrowIcon />
          </Link>
          <Link href="/repositorio" className={styles.secondary}>
            Ver repositorio
          </Link>
        </div>
      </div>

      <div className={styles.tags} aria-label="Colecciones destacadas">
        {layerTags.map((tag) => (
          <span key={tag}>{tag}</span>
        ))}
      </div>
    </section>
  );
}
