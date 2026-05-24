"use client";

import { getPlanes, disciplinas } from "./data";
import type { DisciplinaId, PlanId } from "./types";

interface Props {
  disciplina: DisciplinaId;
  value: PlanId | null;
  onSelect: (plan: PlanId) => void;
  onBack: () => void;
}

export default function Paso2Plan({ disciplina, onSelect, onBack }: Props) {
  const planes = getPlanes(disciplina);
  const disc = disciplinas.find((d) => d.id === disciplina)!;

  return (
    <div className="max-w-4xl mx-auto px-6 pb-16">
      {/* breadcrumb */}
      <div className="flex items-center gap-2 mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 font-body text-sm text-texto-muted hover:text-siena transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Volver
        </button>
        <span className="text-outline-light">/</span>
        <span className="font-body text-sm text-texto">{disc.nombre}</span>
      </div>

      <div className="text-center mb-10">
        <h2 className="font-display text-4xl sm:text-5xl text-siena mb-3">
          Elige tu plan
        </h2>
        <p className="font-body text-texto-muted text-base">
          {disciplina === "ballet-ii"
            ? "Ballet Clásico II requiere dedicación plena — disponible en modalidad Intensiva"
            : "Selecciona la frecuencia que mejor se adapta a tu ritmo de vida"}
        </p>
      </div>

      <div
        className={`grid gap-5 ${
          planes.length === 1
            ? "max-w-sm mx-auto"
            : planes.length === 2
            ? "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto"
            : "grid-cols-1 sm:grid-cols-3"
        }`}
      >
        {planes.map((plan) => (
          <button
            key={plan.id}
            onClick={() => onSelect(plan.id)}
            className={`group relative text-left rounded-3xl p-7 border transition-all duration-300 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-siena focus:ring-offset-2 ${
              plan.destacado
                ? "bg-siena border-siena text-white shadow-lg"
                : "bg-white border-outline-light hover:border-siena-pale shadow-sm hover:shadow-md"
            }`}
          >
            {plan.destacado && (
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-terracota-light text-texto text-xs font-body font-semibold tracking-widest uppercase px-4 py-1.5 rounded-full shadow">
                Más popular
              </span>
            )}

            <div className="mb-5">
              <p
                className={`font-body text-xs tracking-widest uppercase font-semibold mb-2 ${
                  plan.destacado ? "text-siena-light" : "text-outline"
                }`}
              >
                {plan.nombre}
              </p>
              <div className="flex items-end gap-1">
                <span
                  className={`font-display text-5xl font-semibold ${
                    plan.destacado ? "text-white" : "text-siena"
                  }`}
                >
                  {plan.precio}€
                </span>
                <span
                  className={`font-body text-sm mb-2 ${
                    plan.destacado ? "text-siena-light" : "text-texto-muted"
                  }`}
                >
                  / mes
                </span>
              </div>
              <p
                className={`font-body text-sm mt-1 ${
                  plan.destacado ? "text-siena-pale" : "text-texto-muted"
                }`}
              >
                {plan.sesionesPorSemana} clase{plan.sesionesPorSemana > 1 ? "s" : ""} por semana
              </p>
            </div>

            <ul className="space-y-2.5 mb-7">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    className={`mt-0.5 shrink-0 ${plan.destacado ? "text-siena-light" : "text-siena"}`}
                  >
                    <path
                      d="M3 8l3.5 3.5L13 5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span
                    className={`font-body text-sm leading-snug ${
                      plan.destacado ? "text-siena-pale" : "text-texto-muted"
                    }`}
                  >
                    {f}
                  </span>
                </li>
              ))}
            </ul>

            <span
              className={`inline-flex items-center justify-center w-full gap-2 py-3 rounded-full font-body text-sm font-semibold tracking-wider uppercase transition-all duration-200 ${
                plan.destacado
                  ? "bg-white text-siena group-hover:bg-siena-pale"
                  : "bg-siena text-white group-hover:bg-siena-container"
              }`}
            >
              Elegir plan
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="transition-transform group-hover:translate-x-1">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
