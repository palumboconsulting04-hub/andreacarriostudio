"use client";

import type { DisciplinaId, BozzaIscrizione } from "./types";

const ADULTAS = new Set<DisciplinaId>(["pilates-mat", "barre-fit", "ballet-adultos"]);

interface Props {
  disciplinaId: DisciplinaId;
  disciplinaNombre: string;
  planNombre: string;
  planPrecio: number;
  bozzeExistentes: BozzaIscrizione[];
  onContinuar: () => void;
  onAgregarOtra: () => void;
}

export default function Paso4CrossSell({
  disciplinaId,
  disciplinaNombre,
  planNombre,
  planPrecio,
  bozzeExistentes,
  onContinuar,
  onAgregarOtra,
}: Props) {
  const esAdulta = ADULTAS.has(disciplinaId);

  const sugerencia = esAdulta
    ? "¿Tienes una hija que quiera aprender ballet? Tenemos Pre Ballet (3-6 años), Ballet I (7-9 años) y Ballet II (10-14 años)."
    : "¿Te apuntas tú también? Mientras tu hija baila, tú también puedes tener tu momento. Prueba Pilates Mat o Barre Fit.";

  return (
    <div className="max-w-xl mx-auto px-8 py-12">
      <div className="mb-8 text-center">
        <h2
          className="text-4xl mb-2"
          style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", color: "#7d2b13" }}
        >
          ¡Casi listo!
        </h2>
        <p className="text-sm" style={{ color: "#89726c" }}>
          {bozzeExistentes.length > 0
            ? `Ya tienes ${bozzeExistentes.length} inscripción${bozzeExistentes.length > 1 ? "es" : ""} añadida${bozzeExistentes.length > 1 ? "s" : ""}.`
            : "Antes de continuar, una pregunta."}
        </p>
      </div>

      {/* Inscripciones ya guardadas */}
      {bozzeExistentes.length > 0 && (
        <div className="mb-5 space-y-2">
          {bozzeExistentes.map((b, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 rounded-xl border" style={{ borderColor: "#dcc1b9", backgroundColor: "#fff1e9" }}>
              <p className="text-sm font-medium" style={{ color: "#25190f" }}>{b.disciplinaNombre}</p>
              <p className="text-sm" style={{ color: "#89726c" }}>{b.planNombre} · {b.planPrecio}€/mes</p>
            </div>
          ))}
        </div>
      )}

      {/* Resumen actual */}
      <div className="rounded-2xl p-5 mb-6 border" style={{ backgroundColor: "#fff1e9", borderColor: "#dcc1b9" }}>
        <p className="text-xs uppercase tracking-widest mb-2" style={{ color: "#89726c", fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif" }}>
          Añadiendo ahora
        </p>
        <p className="text-lg font-semibold" style={{ color: "#25190f" }}>{disciplinaNombre}</p>
        <p className="text-sm" style={{ color: "#56423d" }}>{planNombre} · {planPrecio}€/mes</p>
      </div>

      {/* Sugerencia cross-sell */}
      <div className="rounded-2xl p-4 mb-8 border" style={{ backgroundColor: "#ffdbd1", borderColor: "#e8c4b8" }}>
        <p className="text-sm leading-relaxed" style={{ color: "#56423d" }}>
          💡 {sugerencia}
        </p>
      </div>

      {/* Botones */}
      <div className="space-y-3">
        <button
          onClick={onAgregarOtra}
          className="w-full py-3 rounded-2xl text-sm font-semibold tracking-widest uppercase transition-opacity hover:opacity-80 border"
          style={{
            borderColor: "#7d2b13",
            color: "#7d2b13",
            backgroundColor: "transparent",
            fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif",
            letterSpacing: "0.1em",
          }}
        >
          Añadir otra inscripción
        </button>
        <button
          onClick={onContinuar}
          className="w-full py-4 rounded-2xl text-sm font-semibold tracking-widest uppercase transition-opacity hover:opacity-90"
          style={{
            backgroundColor: "#7d2b13",
            color: "#fff8f5",
            fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif",
            letterSpacing: "0.1em",
          }}
        >
          Continuar →
        </button>
      </div>
    </div>
  );
}
