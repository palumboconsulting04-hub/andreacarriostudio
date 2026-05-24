"use client";

import type { Disciplina, Plan, HorarioSlot } from "./types";

interface Props {
  disc: Disciplina;
  planInfo: Plan;
  slots: HorarioSlot[];
  value: string[];
  onChange: (horarios: string[]) => void;
  onContinuar: () => void;
  onBack: () => void;
}

function getDisponibilidadColor(disponibles: number, total: number) {
  if (disponibles === 0) return "text-red-500";
  const ratio = disponibles / total;
  if (ratio <= 0.3) return "text-terracota";
  return "text-green-700";
}

function getDisponibilidadLabel(disponibles: number, total: number) {
  if (disponibles === 0) return "Completo";
  return `${disponibles}/${total} plazas`;
}

export default function Paso3Horarios({
  disc,
  planInfo,
  slots,
  value,
  onChange,
  onContinuar,
  onBack,
}: Props) {
  const maxSlots = planInfo.sesionesPorSemana;

  const toggleSlot = (id: string, disponibles: number) => {
    if (disponibles === 0) return;
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else if (value.length < maxSlots) {
      onChange([...value, id]);
    }
  };

  const dias = [...new Set(slots.map((s) => s.dia))];

  return (
    <div className="max-w-3xl mx-auto px-6 pb-16">
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
        <span className="text-outline-light">/</span>
        <span className="font-body text-sm text-texto">{planInfo.nombre}</span>
      </div>

      <div className="text-center mb-8">
        <h2 className="font-display text-4xl sm:text-5xl text-siena mb-3">
          Elige tus horarios
        </h2>
        <p className="font-body text-texto-muted text-base">
          Con el plan{" "}
          <strong className="text-siena font-semibold">{planInfo.nombre}</strong>{" "}
          puedes elegir hasta{" "}
          <strong className="text-siena font-semibold">
            {maxSlots} horario{maxSlots > 1 ? "s" : ""} semanal
            {maxSlots > 1 ? "es" : ""}
          </strong>
        </p>
      </div>

      {/* progress counter */}
      <div className="flex items-center justify-between mb-5 px-1">
        <span className="font-body text-sm text-texto-muted">
          {value.length} de {maxSlots} seleccionado{value.length !== 1 ? "s" : ""}
        </span>
        <div className="flex gap-1.5">
          {Array.from({ length: maxSlots }).map((_, i) => (
            <div
              key={i}
              className={`w-6 h-1.5 rounded-full transition-colors duration-300 ${
                i < value.length ? "bg-siena" : "bg-outline-light"
              }`}
            />
          ))}
        </div>
      </div>

      {/* schedule grid by day */}
      <div className="space-y-4 mb-10">
        {dias.map((dia) => {
          const slotsDelDia = slots.filter((s) => s.dia === dia);
          return (
            <div key={dia} className="bg-white rounded-2xl border border-outline-light overflow-hidden">
              <div className="px-5 py-3 bg-maquillaje border-b border-outline-light">
                <h3 className="font-body text-xs font-semibold tracking-widest uppercase text-texto-muted">
                  {dia}
                </h3>
              </div>
              <div className="divide-y divide-outline-light">
                {slotsDelDia.map((slot) => {
                  const lleno = slot.disponibles === 0;
                  const seleccionado = value.includes(slot.id);
                  const maxAlcanzado = !seleccionado && value.length >= maxSlots;
                  const disabled = lleno || maxAlcanzado;

                  return (
                    <button
                      key={slot.id}
                      onClick={() => toggleSlot(slot.id, slot.disponibles)}
                      disabled={disabled}
                      className={`w-full flex items-center justify-between px-5 py-4 text-left transition-all duration-200 ${
                        seleccionado
                          ? "bg-siena-pale"
                          : disabled
                          ? "opacity-40 cursor-not-allowed"
                          : "hover:bg-blanco-roto"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {/* checkbox */}
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                            seleccionado
                              ? "bg-siena border-siena"
                              : "border-outline-light"
                          }`}
                        >
                          {seleccionado && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>

                        <div>
                          <span className="font-body font-semibold text-texto text-sm">
                            {slot.hora} – {slot.horaFin}
                          </span>
                          {seleccionado && (
                            <span className="ml-2 text-xs font-body font-semibold text-siena tracking-wider uppercase">
                              Seleccionado
                            </span>
                          )}
                        </div>
                      </div>

                      {/* availability badge */}
                      <span
                        className={`font-body text-xs font-semibold ${getDisponibilidadColor(
                          slot.disponibles,
                          slot.total
                        )}`}
                      >
                        {getDisponibilidadLabel(slot.disponibles, slot.total)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={onContinuar}
        disabled={value.length === 0}
        className="w-full py-4 rounded-full font-body font-semibold text-sm tracking-widest uppercase bg-siena text-white hover:bg-siena-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {value.length === 0
          ? "Selecciona al menos un horario"
          : `Continuar con ${value.length} horario${value.length > 1 ? "s" : ""}`}
      </button>
    </div>
  );
}
