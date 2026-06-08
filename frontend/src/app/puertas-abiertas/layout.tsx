import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL("https://andreacarriostudio.vercel.app"),
  title: "Jornada de Puertas Abiertas — Andrea Carrió Studio",
  description:
    "Ven el 24 de julio: conoce el estudio y prueba tu primera clase. Ballet para niñas, Pilates y Barre Fit para adultas. Valencia.",
  openGraph: {
    title: "Jornada de Puertas Abiertas — Andrea Carrió Studio",
    description:
      "Ven el 24 de julio: conoce el estudio y prueba tu primera clase. Ballet para niñas, Pilates y Barre Fit para adultas.",
    url: "https://andreacarriostudio.vercel.app/puertas-abiertas",
    siteName: "Andrea Carrió Studio",
    locale: "es_ES",
    type: "website",
    images: [
      {
        url: "/og-puertas-abiertas.png",
        width: 1200,
        height: 630,
        alt: "Jornada de Puertas Abiertas — Andrea Carrió Studio · 24 de julio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Jornada de Puertas Abiertas — Andrea Carrió Studio",
    description:
      "Ven el 24 de julio: conoce el estudio y prueba tu primera clase. Ballet para niñas, Pilates y Barre Fit para adultas.",
    images: ["/og-puertas-abiertas.png"],
  },
};

export default function PuertasAbiertasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
