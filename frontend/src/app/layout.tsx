import type { Metadata } from "next";
import { Playfair_Display, Montserrat } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import CookieBanner from "@/components/CookieBanner";
import "./globals.css";

const GA_ID = "G-58XTS3Y6NB";

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
        {/* Google Analytics 4 con Consent Mode v2: arranca DENEGADO; el banner
            otorga el consentimiento de analítica solo si la visitante acepta. */}
        <Script id="ga-consent-default" strategy="beforeInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});`}
        </Script>
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="ga-init" strategy="afterInteractive">
          {`gtag('js', new Date());
gtag('config','${GA_ID}');`}
        </Script>

        {children}
        <Analytics />
        <CookieBanner />
      </body>
    </html>
  );
}
