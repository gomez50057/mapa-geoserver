import styles from "./ImpactSection.module.css";

const features = [
  {
    title: "Visor territorial",
    text: "Capas regionales, municipales y metropolitanas en una lectura cartográfica unificada.",
    icon: "map",
  },
  {
    title: "Planeación urbana",
    text: "Instrumentos de planeación organizados por municipio, programa y categoría temática.",
    icon: "layers",
  },
  {
    title: "Consulta técnica",
    text: "Información espacial lista para análisis, revisión institucional y toma de decisiones.",
    icon: "target",
  },
];

const metrics = [
  ["84", "Municipios de Hidalgo"],
  ["4", "Zonas metropolitanas"],
  ["Instrumentos", "Metropolitanos,Estatales, Regionales y Municipales"],
];

function FeatureIcon({ type }) {
  if (type === "layers") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m12 3 9 5-9 5-9-5 9-5Zm0 7.7L16.9 8 12 5.3 7.1 8l4.9 2.7Zm-7.6.1L12 15l7.6-4.2 1.4.8-9 5-9-5 1.4-.8Zm0 3.7L12 18.7l7.6-4.2 1.4.8-9 5-9-5 1.4-.8Z" />
      </svg>
    );
  }

  if (type === "target") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M13 2v2.1a8 8 0 0 1 6.9 6.9H22v2h-2.1a8 8 0 0 1-6.9 6.9V22h-2v-2.1A8 8 0 0 1 4.1 13H2v-2h2.1A8 8 0 0 1 11 4.1V2h2Zm-1 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm0 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 3.8 10 2l4 2 6-1.8V20l-6 1.8-4-2L4 21.6V3.8Zm2 2v13.1l3-0.9V4.9l-3 .9Zm5-.7v13.1l2 1V6.1l-2-1Zm4 1v13.1l3-.9V5.2l-3 .9Z" />
    </svg>
  );
}

export default function ImpactSection() {
  return (
    <section id="territorio" className={styles.section} aria-labelledby="impact-title">
      <div className={styles.copy}>
        <p>Consulta pública y técnica</p>
        <h2 id="impact-title">Un punto de entrada para leer el territorio con capas confiables</h2>
        <span>
          La plataforma concentra información territorial para localizar, contrastar y revisar instrumentos con una experiencia clara en escritorio, tableta y móvil.
        </span>
      </div>

      <div className={styles.grid}>
        {features.map((feature) => (
          <article className={styles.feature} key={feature.title}>
            <div className={styles.icon}>
              <FeatureIcon type={feature.icon} />
            </div>
            <h3>{feature.title}</h3>
            <p>{feature.text}</p>
          </article>
        ))}
      </div>

      <div className={styles.metrics} aria-label="Resumen de plataforma">
        {metrics.map(([value, label]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
