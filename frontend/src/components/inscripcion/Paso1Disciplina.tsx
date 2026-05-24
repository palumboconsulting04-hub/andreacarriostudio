"use client";

import { disciplinas } from "./data";
import type { DisciplinaId } from "./types";

interface Props {
  value: DisciplinaId | null;
  onChange: (id: DisciplinaId) => void;
  onContinuar: () => void;
}

export default function Paso1Disciplina({ value, onChange, onContinuar }: Props) {
  return (
    <div className="max-w-5xl mx-auto px-8 pb-16">
      <div className="mb-10">
        <h2
          className="text-4xl sm:text-5xl mb-3"
          style={{
            fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif",
            color: "#7d2b13",
          }}
        >
          Inscripción — Disciplina
        </h2>
        <p className="text-base" style={{ color: "#56423d" }}>
          Selecciona la disciplina con la que deseas conectar tu cuerpo y mente.
          Nuestra propuesta abraza el movimiento orgánico y la precisión.
        </p>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {disciplinas.map((d) => {
          const seleccionada = value === d.id;
          return (
            <button
              key={d.id}
              onClick={() => onChange(d.id)}
              aria-label={`Seleccionar ${d.nombre}`}
              className="group relative overflow-hidden text-left focus:outline-none"
              style={{
                borderRadius: "24px",
                aspectRatio: "4/5",
                border: seleccionada ? "3px solid #7d2b13" : "2px solid transparent",
                outline: seleccionada ? "4px solid #ffdbd1" : "none",
                outlineOffset: "2px",
                boxShadow: "0 4px 24px rgba(61,43,31,0.07)",
                transition: "all 0.3s ease",
              }}
            >
              {/* Photo */}
              <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105"
                style={{ backgroundImage: `url('${d.imagen}')` }}
              />
              {/* Gradient */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, rgba(37,25,15,0.85) 0%, rgba(37,25,15,0.2) 50%, transparent 100%)",
                }}
              />
              {/* Badge solo intensivo */}
              {d.soloIntensivo && (
                <div className="absolute top-4 left-4">
                  <span
                    className="text-xs font-semibold tracking-widest uppercase px-3 py-1 rounded-full"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.2)",
                      backdropFilter: "blur(8px)",
                      color: "#ffffff",
                    }}
                  >
                    Solo Intensivo
                  </span>
                </div>
              )}
              {/* Checkmark selected */}
              {seleccionada && (
                <div
                  className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: "#7d2b13" }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M2.5 7l3 3 6-6"
                      stroke="white"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
              {/* Arrow on hover */}
              {!seleccionada && (
                <div
                  className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                  style={{ backgroundColor: "rgba(255,248,245,0.9)" }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path
                      d="M2.5 7h9M8 3.5L11.5 7 8 10.5"
                      stroke="#7d2b13"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
              )}
              {/* Text */}
              <div className="absolute bottom-0 left-0 w-full p-6">
                <h3
                  className="text-lg font-semibold mb-1.5"
                  style={{
                    fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif",
                    color: "#ffffff",
                    letterSpacing: "0.05em",
                  }}
                >
                  {d.nombre}
                </h3>
                <p
                  className="text-sm leading-snug line-clamp-2"
                  style={{ color: "rgba(255,255,255,0.85)" }}
                >
                  {d.descripcion}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Bottom navigation */}
      <div className="flex items-center justify-between mt-10">
        <button
          className="flex items-center gap-2 text-sm opacity-40 cursor-not-allowed"
          style={{ color: "#56423d", fontFamily: "var(--font-body)" }}
          disabled
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M10 3L5 8l5 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Atrás
        </button>

        <button
          onClick={onContinuar}
          disabled={!value}
          className="flex items-center gap-2 px-7 py-3 rounded-full text-sm font-semibold uppercase transition-all duration-200"
          style={{
            fontFamily: "var(--font-body)",
            letterSpacing: "0.12em",
            backgroundColor: value ? "#7d2b13" : "#dcc1b9",
            color: value ? "#ffffff" : "#89726c",
            cursor: value ? "pointer" : "not-allowed",
          }}
        >
          Continuar
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M6 3l5 5-5 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
