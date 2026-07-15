import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Clase de prueba gratis para adultas — Andrea Carrió Studio",
  description: "Barre Fit y Pilates Mat en Valencia. Reserva tu clase de prueba gratis en la jornada de puertas abiertas, sin compromiso.",
  openGraph: {
    title: "Clase de prueba gratis para adultas — Andrea Carrió Studio",
    description: "Barre Fit y Pilates Mat en Valencia. Reserva tu clase de prueba gratis en la jornada de puertas abiertas, sin compromiso.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
