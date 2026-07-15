import { Suspense } from "react";
import type { Metadata } from "next";
import BonoGracias from "./BonoGracias";

export const metadata: Metadata = {
  title: "¡Gracias por tu compra! — Andrea Carrió Studio",
  description: "Tu bono ya está listo. Entra en Mis clases para reservar tus clases.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", backgroundColor: "#f5ede8" }} />}>
      <BonoGracias />
    </Suspense>
  );
}
