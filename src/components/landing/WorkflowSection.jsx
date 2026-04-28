import Link from "next/link";
import styles from "./WorkflowSection.module.css";

const steps = [
  ["01", "Ubica", "Selecciona municipio, zona metropolitana o instrumento."],
  ["02", "Compara", "Activa capas y revisa la lectura territorial en el visor."],
  ["03", "Descarga", "Obtén datos en formatos compatibles con flujos SIG."],
];

export default function WorkflowSection() {
  return (
    <section id="consulta" className={styles.section} aria-labelledby="workflow-title">
      <div className={styles.heading}>
        <p>Ruta de consulta</p>
        <h2 id="workflow-title">Del mapa al dato descargable.</h2>
      </div>

      <div className={styles.steps}>
        {steps.map(([number, title, text]) => (
          <article key={number} className={styles.step}>
            <span>{number}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>

      <div className={styles.cta}>
        <Link href="/mapa">Abrir mapa</Link>
        <Link href="/repositorio">Descargar capas</Link>
      </div>
    </section>
  );
}
