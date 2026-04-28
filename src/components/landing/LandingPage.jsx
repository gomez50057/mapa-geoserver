import HeroSection from "./HeroSection";
import ImpactSection from "./ImpactSection";
import RepositoryTeaser from "./RepositoryTeaser";
import WorkflowSection from "./WorkflowSection";
import styles from "./LandingPage.module.css";

export default function LandingPage() {
  return (
    <main className={styles.page}>
      <HeroSection />
      <ImpactSection />
      <RepositoryTeaser />
      <WorkflowSection />
    </main>
  );
}
