"use client";

import { useState } from "react";
import { submitIscrizione } from "@/lib/queries";
import type { InscripcionState, MetodoPago, Disciplina, Plan } from "./types";

interface Props {
  estado: InscripcionState;
  disc: Disciplina;
  plan: Plan;
  onChange: (updates: Partial<InscripcionState>) => void;
  onBack: () => void;
}

const metodosPago: { id: MetodoPago; label: string; proximamente?: boolean }[] = [
  { id: "en-escuela", label: "Pagar en la escuela" },
  { id: "tarjeta", label: "Tarjeta de crédito", proximamente: true },
  { id: "google-pay", label: "Google Pay", proximamente: true },
  { id: "apple-pay", label: "Apple Pay", proximamente: true },
  { id: "paypal", label: "PayPal", proximamente: true },
];

function ModalPrivacidad({ onClose, onAceptar }: { onClose: () => void; onAceptar: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(37,25,15,0.6)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-3xl p-8"
        style={{ backgroundColor: "#fff8f5", boxShadow: "0 8px 40px rgba(37,25,15,0.2)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-sm font-semibold hover:opacity-70 transition-opacity"
          style={{ color: "#89726c" }}
        >
          ✕
        </button>

        <h2
          className="text-2xl mb-6"
          style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", color: "#7d2b13" }}
        >
          Protección de Datos
        </h2>

        <div className="space-y-4 text-sm leading-relaxed" style={{ color: "#56423d" }}>
          <div>
            <p className="font-semibold mb-1" style={{ color: "#25190f" }}>Responsable del tratamiento</p>
            <p>Andrea Carrió, titular de Andrea Carrió Studio, C/ Motilla del Palancar 34, Alfauir (Valencia). Contacto: andreacarriostudio@gmail.com</p>
          </div>
          <div>
            <p className="font-semibold mb-1" style={{ color: "#25190f" }}>Finalidad</p>
            <p>Gestionar la inscripción, impartir las clases, cobrar las cuotas, cumplir las obligaciones fiscales y contables y adaptar la práctica a la información médica facilitada.</p>
          </div>
          <div>
            <p className="font-semibold mb-1" style={{ color: "#25190f" }}>Base jurídica</p>
            <p>Ejecución del contrato de prestación del servicio y cumplimiento de obligaciones legales (RGPD, art. 6.1.b y c). Para datos de salud, su consentimiento explícito (RGPD, art. 9.2.a).</p>
          </div>
          <div>
            <p className="font-semibold mb-1" style={{ color: "#25190f" }}>Conservación</p>
            <p>Durante la relación con el estudio y, una vez finalizada, durante los plazos legalmente exigidos (hasta 6 años a efectos fiscales). Los datos médicos se suprimirán al finalizar la relación.</p>
          </div>
          <div>
            <p className="font-semibold mb-1" style={{ color: "#25190f" }}>Destinatarios</p>
            <p>No se cederán datos a terceros salvo obligación legal. Podrán acceder proveedores necesarios para la gestión del estudio (gestoría, entidad bancaria, software de gestión), que actuarán como encargados del tratamiento conforme al art. 28 RGPD.</p>
          </div>
          <div>
            <p className="font-semibold mb-1" style={{ color: "#25190f" }}>Derechos</p>
            <p>Puede ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a andreacarriostudio@gmail.com, adjuntando copia de su DNI. Tiene derecho a reclamar ante la Agencia Española de Protección de Datos (www.aepd.es).</p>
          </div>
          <div>
            <p className="font-semibold mb-1" style={{ color: "#25190f" }}>Menores</p>
            <p>El tratamiento de datos de alumnas menores de 14 años requiere el consentimiento de su madre, padre o tutor legal (art. 7 LOPDGDD).</p>
          </div>
        </div>

        <button
          onClick={() => { onAceptar(); onClose(); }}
          className="mt-6 w-full py-3 rounded-full text-sm font-semibold tracking-widest uppercase transition-colors"
          style={{ backgroundColor: "#7d2b13", color: "#ffffff" }}
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

export default function Paso4Pago({ estado, disc, plan, onChange, onBack }: Props) {
  const [confirmado, setConfirmado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rgpdAceptado, setRgpdAceptado] = useState(false);
  const [modalPrivacidad, setModalPrivacidad] = useState(false);

  const esNinas = ["ballet-i", "ballet-ii", "pre-ballet"].includes(disc.id);

  const puedeConfirmar =
    estado.nombre.trim() !== "" &&
    estado.apellido.trim() !== "" &&
    estado.email.trim() !== "" &&
    rgpdAceptado &&
    (!esNinas || (estado.nombreAlumna.trim() !== "" && estado.apellidoAlumna.trim() !== ""));

  const handleConfirmar = async () => {
    if (!puedeConfirmar || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      await submitIscrizione(estado);
      setConfirmado(true);
    } catch {
      setError("Ha ocurrido un error. Por favor, inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

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

          {esNinas ? (
            <>
              <p className="text-sm" style={{ color: "#89726c" }}>
                Al tratarse de una disciplina infantil, indica primero los datos del tutor y luego los de la alumna.
              </p>

              <div>
                <p className="text-xs tracking-widest uppercase font-semibold mb-3" style={{ color: "#7d2b13", fontFamily: "var(--font-montserrat)" }}>
                  Tutor / Responsable
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Nombre tutor" type="text" value={estado.nombre} onChange={(v) => onChange({ nombre: v })} placeholder="Ana" />
                  <Field label="Apellido tutor" type="text" value={estado.apellido} onChange={(v) => onChange({ apellido: v })} placeholder="García" />
                </div>
              </div>

              <Field label="Email" type="email" value={estado.email} onChange={(v) => onChange({ email: v })} placeholder="ana@email.com" />
              <Field label="Teléfono" type="tel" value={estado.telefono} onChange={(v) => onChange({ telefono: v })} placeholder="+34 600 000 000" />

              <div>
                <p className="text-xs tracking-widest uppercase font-semibold mb-3" style={{ color: "#7d2b13", fontFamily: "var(--font-montserrat)" }}>
                  Datos de la alumna
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Nombre alumna" type="text" value={estado.nombreAlumna} onChange={(v) => onChange({ nombreAlumna: v })} placeholder="María" />
                  <Field label="Apellido alumna" type="text" value={estado.apellidoAlumna} onChange={(v) => onChange({ apellidoAlumna: v })} placeholder="García" />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Nombre" type="text" value={estado.nombre} onChange={(v) => onChange({ nombre: v })} placeholder="Ana" />
                <Field label="Apellido" type="text" value={estado.apellido} onChange={(v) => onChange({ apellido: v })} placeholder="García" />
              </div>
              <Field label="Email" type="email" value={estado.email} onChange={(v) => onChange({ email: v })} placeholder="ana@email.com" />
              <Field label="Teléfono" type="tel" value={estado.telefono} onChange={(v) => onChange({ telefono: v })} placeholder="+34 600 000 000" />
            </>
          )}

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
                const disabled = !!m.proximamente;
                return (
                  <button
                    key={m.id}
                    onClick={() => !disabled && onChange({ metodoPago: m.id })}
                    disabled={disabled}
                    className="rounded-xl border px-4 py-3 text-sm transition-all text-left relative"
                    style={{
                      borderColor: activo ? "#7d2b13" : "#dcc1b9",
                      backgroundColor: disabled ? "#f5f5f5" : activo ? "#ffdbd1" : "#fff1e9",
                      color: disabled ? "#aaa" : activo ? "#7d2b13" : "#56423d",
                      fontWeight: activo ? 600 : 400,
                      cursor: disabled ? "not-allowed" : "pointer",
                    }}
                  >
                    {m.label}
                    {m.proximamente && (
                      <span
                        className="absolute top-1.5 right-2 text-[10px] tracking-wider uppercase font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: "#dcc1b9", color: "#56423d" }}
                      >
                        Próximamente
                      </span>
                    )}
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

            {modalPrivacidad && <ModalPrivacidad onClose={() => setModalPrivacidad(false)} onAceptar={() => setRgpdAceptado(true)} />}

            <label className="flex items-start gap-2.5 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={rgpdAceptado}
                onChange={(e) => setRgpdAceptado(e.target.checked)}
                className="mt-0.5 shrink-0 accent-[#7d2b13]"
              />
              <span className="text-xs leading-snug" style={{ color: "#56423d" }}>
                Acepto el tratamiento de mis datos personales según la{" "}
                <button
                  type="button"
                  onClick={() => setModalPrivacidad(true)}
                  className="underline hover:opacity-70 transition-opacity"
                  style={{ color: "#7d2b13" }}
                >
                  política de privacidad
                </button>
              </span>
            </label>

            {error && (
              <p className="text-xs text-red-600 text-center mb-3">{error}</p>
            )}

            <button
              onClick={handleConfirmar}
              disabled={!puedeConfirmar || enviando}
              className="w-full py-4 rounded-full text-sm tracking-widest uppercase font-semibold transition-colors"
              style={{
                backgroundColor: puedeConfirmar && !enviando ? "#7d2b13" : "#dcc1b9",
                color: "#ffffff",
                cursor: puedeConfirmar && !enviando ? "pointer" : "not-allowed",
              }}
            >
              {enviando ? "Enviando..." : "Confirmar inscripción"}
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
