import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ponte en forma este septiembre — Pilates Mat y Barre Fit en Valencia",
  description: "¿Vuelves del verano con ganas de retomar la rutina? Tonifica y recupera tu cuerpo con Pilates Mat y Barre Fit en Valencia (Alfahuir). Grupos reducidos, trato cercano. Reserva tu plaza de septiembre.",
  openGraph: {
    title: "Ponte en forma este septiembre — Pilates Mat y Barre Fit en Valencia",
    description: "¿Vuelves del verano con ganas de retomar la rutina? Tonifica y recupera tu cuerpo con Pilates Mat y Barre Fit en Valencia (Alfahuir). Grupos reducidos, trato cercano. Reserva tu plaza de septiembre.",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
