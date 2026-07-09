import { Suspense } from "react";
import BonoGracias from "./BonoGracias";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", backgroundColor: "#f5ede8" }} />}>
      <BonoGracias />
    </Suspense>
  );
}
