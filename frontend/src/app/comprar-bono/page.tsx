import { Suspense } from "react";
import type { Metadata } from "next";
import ComprarBono from "./ComprarBono";

export const metadata: Metadata = {
  title: "Bonos de Barre y Pilates — Andrea Carrió Studio",
  description: "Compra tu bono de clases de Barre Fit o Pilates Mat en Valencia: 1, 5 o 12 clases para reservar cuando quieras, sin permanencia.",
  openGraph: {
    title: "Bonos de Barre y Pilates — Andrea Carrió Studio",
    description: "Bonos de Barre Fit y Pilates Mat en Valencia: 1, 5 o 12 clases para reservar cuando quieras, sin permanencia.",
  },
};

export default function Page() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", backgroundColor: "#f5ede8" }} />}>
      <ComprarBono />
    </Suspense>
  );
}
