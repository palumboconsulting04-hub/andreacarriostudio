import type { Metadata } from "next";

// Metadata específica de "Mis clases" para que se instale bien como app en iOS
// (icono y título al añadir a la pantalla de inicio).
export const metadata: Metadata = {
  title: "Mis clases — Andrea Carrió Studio",
  appleWebApp: {
    capable: true,
    title: "Mis clases",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export default function MisClasesLayout({ children }: { children: React.ReactNode }) {
  return children;
}
