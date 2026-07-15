import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reserva tu plaza — Jornada de Puertas Abiertas — Andrea Carrió Studio",
  description: "Elige tu turno gratis para la jornada de puertas abiertas: ballet para niñas y Barre Fit y Pilates para adultas, en Valencia.",
  openGraph: {
    title: "Reserva tu plaza — Jornada de Puertas Abiertas — Andrea Carrió Studio",
    description: "Elige tu turno gratis para la jornada de puertas abiertas: ballet para niñas y Barre Fit y Pilates para adultas, en Valencia.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
