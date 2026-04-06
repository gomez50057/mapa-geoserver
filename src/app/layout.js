import "@/styles/globals.css";

export const metadata = {
  applicationName: 'geogeoconnect',
  title: {
    default: 'geogeoconnect',
    template: '%s | geogeoconnect',
  },
  description:
      'Visor capas PMDU.',
  keywords: ['Next.js', 'Leaflet', 'GeoJSON', 'mosaicos', 'SIG', 'PMDU', 'Hidalgo'],
  authors: [{ name: 'Gabriel Gómez' }],
  icons: { icon: '/favicon.ico' },
  alternates: { canonical: '/' },
  openGraph: {
    title: 'geogeoconnect',
    description:
      'Visor capas PMDU.',
    url: '/',
    siteName: 'geogeoconnect',
    locale: 'es_MX',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'geogeoconnect',
    description:
      'Visor capas PMDU.',
  },
};


export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
