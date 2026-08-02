import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pilates Mat y Barre Fit para adultas en Valencia — Andrea Carrió Studio",
  description: "Tonifica tu cuerpo, mejora tu postura y desconecta con Pilates Mat y Barre Fit en Valencia (Zona Alfahuir). Grupos reducidos y atención personalizada. Reserva tu plaza.",
  openGraph: {
    title: "Pilates Mat y Barre Fit para adultas en Valencia — Andrea Carrió Studio",
    description: "Tonifica tu cuerpo, mejora tu postura y desconecta con Pilates Mat y Barre Fit en Valencia (Zona Alfahuir). Grupos reducidos y atención personalizada. Reserva tu plaza.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
