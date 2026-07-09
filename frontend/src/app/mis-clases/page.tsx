import { Suspense } from "react";
import MisClasesPanel from "./MisClasesPanel";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", backgroundColor: "#f5ede8" }} />}>
      <MisClasesPanel />
    </Suspense>
  );
}
