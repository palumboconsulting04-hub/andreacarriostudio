"use client";

import { useState } from "react";
import Paso5Gracias from "@/components/inscripcion/Paso5Gracias";
import type { DisciplinaId } from "@/components/inscripcion/types";

// Previsualización de la pantalla de "gracias" tras la inscripción, sin tener
// que hacer una compra real. Solo accesible desde el admin (login). El modo
// preview evita escribir nada en la base de datos.
export default function PreviewGracias() {
  const [disciplina, setDisciplina] = useState<DisciplinaId>("ballet-i");
  const esNinas = disciplina === "ballet-i";

  const tabStyle = (activo: boolean) => ({
    padding: "8px 18px",
    borderRadius: "999px",
    border: activo ? "2px solid #7d2b13" : "2px solid #dcc1b9",
    backgroundColor: activo ? "#7d2b13" : "#fff8f5",
    color: activo ? "#fff8f5" : "#7d2b13",
    fontSize: "0.8rem",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif",
  });

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#fff8f5" }}>
      {/* Barra de previsualización (no forma parte de la pantalla real) */}
      <div
        className="flex flex-wrap items-center justify-center gap-2 px-4 py-3"
        style={{ backgroundColor: "#25190f" }}
      >
        <span
          className="text-xs uppercase tracking-widest mr-2"
          style={{ color: "#dcc1b9", fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif" }}
        >
          Vista previa · pantalla de gracias
        </span>
        <button onClick={() => setDisciplina("ballet-i")} style={tabStyle(esNinas)}>
          Inscripción niña
        </button>
        <button onClick={() => setDisciplina("pilates-mat")} style={tabStyle(!esNinas)}>
          Inscripción adulta
        </button>
      </div>

      {/* La pantalla real, con datos de ejemplo. key reinicia el estado al cambiar. */}
      <Paso5Gracias
        key={disciplina}
        iscrizioneId="preview"
        disciplinaId={disciplina}
        nombre={esNinas ? "María" : "Laura"}
        preview
      />
    </div>
  );
}
