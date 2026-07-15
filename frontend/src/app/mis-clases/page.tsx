import { Suspense } from "react";
import type { Metadata } from "next";
import MisClasesPanel from "./MisClasesPanel";

export const metadata: Metadata = {
  title: "Mis clases — Andrea Carrió Studio",
  description: "Tu área personal para ver y reservar tus clases y gestionar tu bono o tu mensualidad.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", backgroundColor: "#f5ede8" }} />}>
      <MisClasesPanel />
    </Suspense>
  );
}
