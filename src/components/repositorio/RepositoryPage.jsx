import RepositoryHero from "./RepositoryHero";
import LayerCatalog from "./LayerCatalog";
import styles from "./RepositoryPage.module.css";

export default function RepositoryPage({ catalog }) {
  return (
    <main className={styles.page}>
      <RepositoryHero stats={catalog.stats} formats={catalog.formats} />
      <LayerCatalog catalog={catalog} />
    </main>
  );
}
