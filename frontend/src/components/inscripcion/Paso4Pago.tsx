"use client";

import { useState } from "react";
import { disciplinas, getPlanes } from "./data";
import type { InscripcionState, MetodoPago } from "./types";

interface Props {
  estado: InscripcionState;
  onChange: (updates: Partial<InscripcionState>) => void;
  onBack: () => void;
}

const metodosPago: { id: MetodoPago; label: string }[] = [
  { id: "tarjeta", label: "Tarjeta" },
  { id: "google-pay", label: "Google Pay" },
  { id: "apple-pay", label: "Apple Pay" },
  { id: "paypal", label: "PayPal" },
];

export default function Paso4Pago({ estado, onChange, onBack }: Props) {
  const [confirmado, setConfirmado] = useState(false);

  const disc = disciplinas.find((d) => d.id === estado.disciplina)!;
  const plan = getPlanes(estado.disciplina!).find((p) => p.id === estado.plan)!;

  const puedeConfirmar = estado.nombre.trim() !== "" && estado.email.trim() !== "";

  if (confirmado) {
    return (
      <div className="max-w-md mx-auto px-6 pb-16 text-center pt-12">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ backgroundColor: "#ffdbd1" }}
        >
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <path d="M8 18l7 7 13-13" stroke="#7d2b13" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2
          className="text-4xl mb-3"
          style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", color: "#7d2b13" }}
        >
          ¡Inscripción confirmada!
        </h2>
        <p className="text-base mb-2" style={{ color: "#56423d" }}>
          Tu inscripción a <strong style={{ color: "#7d2b13" }}>{disc.nombre}</strong> ha sido confirmada.
        </p>
        <p className="text-sm" style={{ color: "#56423d" }}>
          Te hemos enviado un email con todos los detalles
          {estado.email ? (
            <> a <strong>{estado.email}</strong></>
          ) : null}.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 pb-16">
      {/* breadcrumb */}
      <div className="flex items-center gap-2 mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm transition-colors hover:opacity-70"
          style={{ color: "#56423d" }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Volver
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Form */}
        <div className="lg:col-span-3 space-y-6">
          <h2
            className="text-4xl"
            style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", color: "#7d2b13" }}
          >
            Datos personales
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Nombre"
              type="text"
              value={estado.nombre}
              onChange={(v) => onChange({ nombre: v })}
              placeholder="Ana"
            />
            <Field
              label="Apellido"
              type="text"
              value={estado.apellido}
              onChange={(v) => onChange({ apellido: v })}
              placeholder="García"
            />
          </div>

          <Field
            label="Email"
            type="email"
            value={estado.email}
            onChange={(v) => onChange({ email: v })}
            placeholder="ana@email.com"
          />

          <Field
            label="Teléfono"
            type="tel"
            value={estado.telefono}
            onChange={(v) => onChange({ telefono: v })}
            placeholder="+34 600 000 000"
          />

          {/* Payment method */}
          <div>
            <h3
              className="text-2xl mb-4"
              style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", color: "#7d2b13" }}
            >
              Método de pago
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {metodosPago.map((m) => {
                const activo = estado.metodoPago === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => onChange({ metodoPago: m.id })}
                    className="rounded-xl border px-4 py-3 text-sm transition-all text-left"
                    style={{
                      borderColor: activo ? "#7d2b13" : "#dcc1b9",
                      backgroundColor: activo ? "#ffdbd1" : "#fff1e9",
                      color: activo ? "#7d2b13" : "#56423d",
                      fontWeight: activo ? 600 : 400,
                    }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="lg:col-span-2">
          <div
            className="rounded-3xl border p-6 sticky top-24"
            style={{ backgroundColor: "#ffffff", borderColor: "#dcc1b9" }}
          >
            <h3
              className="text-xl mb-4"
              style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", color: "#7d2b13" }}
            >
              Resumen
            </h3>

            <div className="space-y-3 mb-5">
              <SummaryRow label="Disciplina" value={disc.nombre} />
              <SummaryRow label="Plan" value={plan.nombre} />
              <SummaryRow
                label="Clases / semana"
                value={`${plan.sesionesPorSemana}`}
              />
              {estado.horarios.length > 0 && (
                <SummaryRow
                  label="Horarios elegidos"
                  value={`${estado.horarios.length}`}
                />
              )}
              <div
                className="border-t pt-3 flex justify-between items-end"
                style={{ borderColor: "#dcc1b9" }}
              >
                <span className="text-sm" style={{ color: "#56423d" }}>
                  Total mensual
                </span>
                <span
                  className="text-3xl"
                  style={{
                    fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif",
                    color: "#7d2b13",
                  }}
                >
                  {plan.precio}€
                </span>
              </div>
            </div>

            <button
              onClick={() => setConfirmado(true)}
              disabled={!puedeConfirmar}
              className="w-full py-4 rounded-full text-sm tracking-widest uppercase font-semibold transition-colors"
              style={{
                backgroundColor: puedeConfirmar ? "#7d2b13" : "#dcc1b9",
                color: "#ffffff",
                cursor: puedeConfirmar ? "pointer" : "not-allowed",
              }}
            >
              Confirmar inscripción
            </button>

            <p className="text-xs text-center mt-3" style={{ color: "#89726c" }}>
              Sin compromiso. Cancela cuando quieras.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label
        className="block text-xs tracking-widest uppercase mb-2"
        style={{ color: "#56423d", fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif" }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border px-4 py-3 text-sm transition-colors focus:outline-none"
        style={{
          borderColor: "#dcc1b9",
          backgroundColor: "#fff1e9",
          color: "#25190f",
          fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif",
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "#7d2b13")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "#dcc1b9")}
      />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-sm" style={{ color: "#56423d" }}>
        {label}
      </span>
      <span className="text-sm font-semibold" style={{ color: "#25190f" }}>
        {value}
      </span>
    </div>
  );
}
