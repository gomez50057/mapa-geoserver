import "@/styles/globals.css";
import AppChrome from "@/components/shared/AppChrome";
import GoogleAnalytics from "@/components/shared/GoogleAnalytics";

export const metadata = {
  applicationName: "Mapa digital regional y metropolitano",
  title: {
    default: "Mapa digital regional y metropolitano",
    template: "%s | Mapa digital regional y metropolitano",
  },
  description:
    "Visor cartográfico para consulta de capas regionales, metropolitanas y de instrumentos de planeación urbana del Estado de Hidalgo.",
  keywords: [
    "Mapa digital regional y metropolitano",
    "SIG",
    "Hidalgo",
    "GeoServer",
    "Leaflet",
    "PMDU",
    "planeación urbana",
    "zonas metropolitanas",
    "cartografía",
    "ordenamiento territorial",
  ],
  authors: [
    {
      name: "Unidad de Planeación y Prospectiva - Coordinación General de Planeación y Proyectos - Gabriel Gómez Gómez",
    },
  ],
  creator: "Unidad de Planeación y Prospectiva - Coordinación General de Planeación y Proyectos",
  publisher: "Gobierno del Estado de Hidalgo",
  category: "Geoinformación y planeación territorial",
  icons: { icon: "/favicon.ico" },
  robots: {
    index: true,
    follow: true,
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    title: "Mapa digital regional y metropolitano",
    description:
      "Consulta cartográfica de capas regionales, metropolitanas y de instrumentos de planeación urbana para el Estado de Hidalgo.",
    siteName: "Mapa digital regional y metropolitano",
    locale: "es_MX",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mapa digital regional y metropolitano",
    description:
      "Visor cartográfico para consulta de capas regionales, metropolitanas y de planeación urbana en Hidalgo.",
  },
};


export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <GoogleAnalytics />
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
