"use client";

import { disciplinas } from "./data";
import type { DisciplinaId } from "./types";

interface Props {
  value: DisciplinaId | null;
  onSelect: (id: DisciplinaId) => void;
}

export default function Paso1Disciplina({ onSelect }: Props) {
  return (
    <div className="max-w-5xl mx-auto px-6 pb-16">
      <div className="text-center mb-10">
        <h2 className="font-display text-4xl sm:text-5xl text-siena mb-3">
          Elige tu disciplina
        </h2>
        <p className="font-body text-texto-muted text-base">
          Selecciona la actividad que quieres practicar este mes
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {disciplinas.map((d) => (
          <button
            key={d.id}
            onClick={() => onSelect(d.id)}
            className="group text-left rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1 bg-white border border-outline-light focus:outline-none focus:ring-2 focus:ring-siena focus:ring-offset-2"
          >
            {/* card header */}
            <div
              className="h-44 flex items-center justify-center relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${d.gradientFrom}, ${d.gradientTo})`,
              }}
            >
              <span className="text-6xl select-none">{d.emoji}</span>
              {d.soloIntensivo && (
                <span className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm text-white text-xs font-body font-semibold tracking-widest uppercase px-3 py-1 rounded-full">
                  Intensivo
                </span>
              )}
            </div>

            {/* card body */}
            <div className="p-5">
              <h3
                className="font-display text-xl mb-1.5 group-hover:text-siena-container transition-colors"
                style={{ color: d.soloIntensivo ? "#7d2b13" : "#25190f" }}
              >
                {d.nombre}
              </h3>
              <p className="font-body text-sm text-texto-muted leading-relaxed mb-4">
                {d.descripcion}
              </p>
              <span className="inline-flex items-center gap-1.5 font-body text-sm font-semibold text-siena tracking-wider uppercase">
                Seleccionar
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="transition-transform group-hover:translate-x-1">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
