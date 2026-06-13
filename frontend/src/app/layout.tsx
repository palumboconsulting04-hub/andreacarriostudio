import type { Metadata } from "next";
import { Playfair_Display, Montserrat } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import SiteAnalytics from "@/components/SiteAnalytics";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://andreacarriostudio.vercel.app"),
  title: "Inscripción — Andrea Carrió Studio",
  description: "Inscripción mensual a clases de Pilates, Barre y Ballet Clásico.",
  openGraph: {
    title: "Andrea Carrió Studio — Danza y Pilates",
    description: "Inscripción mensual a clases de Pilates, Barre y Ballet Clásico.",
    url: "https://andreacarriostudio.vercel.app",
    siteName: "Andrea Carrió Studio",
    locale: "es_ES",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Andrea Carrió Studio — Danza y Pilates",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Andrea Carrió Studio — Danza y Pilates",
    description: "Inscripción mensual a clases de Pilates, Barre y Ballet Clásico.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${playfair.variable} ${montserrat.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block"
        />
        {children}
        <Analytics />
        <SiteAnalytics />
      </body>
    </html>
  );
}
