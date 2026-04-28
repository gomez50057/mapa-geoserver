import RepositoryPage from "@/components/repositorio/RepositoryPage";
import { buildRepositoryCatalog } from "@/components/repositorio/repositoryCatalog";

export const metadata = {
  title: "Repositorio de Instrumentos de Planeación",
  description:
    "Catálogo descargable de capas territoriales e instrumentos de planeación disponibles en el Mapa Digital Regional y Metropolitano.",
};

export default function RepositorioPage() {
  const catalog = buildRepositoryCatalog();
  return <RepositoryPage catalog={catalog} />;
}
