import { Suspense } from "react";
import ComprarBono from "./ComprarBono";

export default function Page() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", backgroundColor: "#f5ede8" }} />}>
      <ComprarBono />
    </Suspense>
  );
}
