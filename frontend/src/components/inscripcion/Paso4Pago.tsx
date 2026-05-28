"use client";

import { useState } from "react";
import { submitIscrizione, getOrCreateContatto } from "@/lib/queries";
import type { InscripcionState, MetodoPago, BozzaIscrizione } from "./types";
import type { InscripcionEmailData } from "@/app/api/send-confirmation/route";

interface Props {
  estado: InscripcionState;
  bozze: BozzaIscrizione[];
  onChange: (updates: Partial<InscripcionState>) => void;
  onBack: () => void;
  onConfirmado: (contattoId: string, iscrizioneId: string) => void;
  existingContattoId?: string | null;
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
        <button onClick={onClose} className="absolute top-5 right-5 text-sm font-semibold hover:opacity-70" style={{ color: "#89726c" }}>✕</button>
        <h2 className="text-2xl mb-6" style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", color: "#7d2b13" }}>
          Protección de Datos
        </h2>
        <div className="space-y-4 text-sm leading-relaxed" style={{ color: "#56423d" }}>
          <div><p className="font-semibold mb-1" style={{ color: "#25190f" }}>Responsable del tratamiento</p><p>Andrea Carrió, titular de Andrea Carrió Studio, C/ Motilla del Palancar 34, Alfauir (Valencia). Contacto: andreacarriostudio@gmail.com</p></div>
          <div><p className="font-semibold mb-1" style={{ color: "#25190f" }}>Finalidad</p><p>Gestionar la inscripción, impartir las clases, cobrar las cuotas, cumplir las obligaciones fiscales y contables y adaptar la práctica a la información médica facilitada.</p></div>
          <div><p className="font-semibold mb-1" style={{ color: "#25190f" }}>Base jurídica</p><p>Ejecución del contrato de prestación del servicio y cumplimiento de obligaciones legales (RGPD, art. 6.1.b y c). Para datos de salud, su consentimiento explícito (RGPD, art. 9.2.a).</p></div>
          <div><p className="font-semibold mb-1" style={{ color: "#25190f" }}>Conservación</p><p>Durante la relación con el estudio y, una vez finalizada, durante los plazos legalmente exigidos (hasta 6 años a efectos fiscales).</p></div>
          <div><p className="font-semibold mb-1" style={{ color: "#25190f" }}>Destinatarios</p><p>No se cederán datos a terceros salvo obligación legal.</p></div>
          <div><p className="font-semibold mb-1" style={{ color: "#25190f" }}>Derechos</p><p>Puede ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad escribiendo a andreacarriostudio@gmail.com.</p></div>
          <div><p className="font-semibold mb-1" style={{ color: "#25190f" }}>Menores</p><p>El tratamiento de datos de alumnas menores de 14 años requiere el consentimiento de su madre, padre o tutor legal (art. 7 LOPDGDD).</p></div>
        </div>
        <button onClick={() => { onAceptar(); onClose(); }} className="mt-6 w-full py-3 rounded-full text-sm font-semibold tracking-widest uppercase" style={{ backgroundColor: "#7d2b13", color: "#ffffff" }}>
          Entendido
        </button>
      </div>
    </div>
  );
}

export default function Paso4Pago({ estado, bozze, onChange, onBack, onConfirmado, existingContattoId }: Props) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rgpdAceptado, setRgpdAceptado] = useState(false);
  const [modalPrivacidad, setModalPrivacidad] = useState(false);
  // Alumna name per niñas bozza
  const [alumnas, setAlumnas] = useState<{ nombre: string; apellido: string }[]>(
    bozze.map(() => ({ nombre: "", apellido: "" }))
  );

  const segundaInscripcion = !!existingContattoId;
  const bozzeNinas = bozze.map((b, i) => ({ bozza: b, idx: i })).filter(({ bozza }) => bozza.esNinas);
  const totalMensual = bozze.reduce((s, b) => s + b.planPrecio, 0);

  const MATRICULA_OFERTA_HASTA = new Date("2026-07-31T23:59:59");
  const matriculaPrecio = new Date() <= MATRICULA_OFERTA_HASTA ? 35 : 50;
  const matriculaOferta = new Date() <= MATRICULA_OFERTA_HASTA;

  const contactoOk = segundaInscripcion
    ? true
    : estado.nombre.trim() !== "" && estado.apellido.trim() !== "" && estado.email.trim() !== "";

  const alumnaOk = bozzeNinas.every(({ idx }) =>
    alumnas[idx]?.nombre.trim() !== "" && alumnas[idx]?.apellido.trim() !== ""
  );

  const puedeConfirmar = contactoOk && alumnaOk && rgpdAceptado;

  const updateAlumna = (idx: number, field: "nombre" | "apellido", value: string) => {
    setAlumnas(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  };

  const handleConfirmar = async () => {
    if (!puedeConfirmar || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      let cId = existingContattoId ?? null;
      if (!cId) {
        cId = await getOrCreateContatto(estado.nombre, estado.apellido, estado.email, estado.telefono || null);
      }
      let firstId = "";
      for (let i = 0; i < bozze.length; i++) {
        const b = bozze[i];
        const bEstado = {
          ...estado,
          disciplina: b.disciplinaId,
          plan: b.planId,
          horarios: b.horarios,
          nombreAlumna: b.esNinas ? (alumnas[i]?.nombre ?? "") : "",
          apellidoAlumna: b.esNinas ? (alumnas[i]?.apellido ?? "") : "",
        };
        const id = await submitIscrizione(cId, bEstado, i === 0 ? matriculaPrecio : 0);
        if (i === 0) firstId = id;
      }

      // Send confirmation email (non-blocking)
      const emailPayload: InscripcionEmailData = {
        email: estado.email,
        nombre: estado.nombre,
        apellido: estado.apellido,
        totalMensual,
        matricula: matriculaPrecio,
        metodoPago: estado.metodoPago,
        notifyAdmin: true,
        inscripciones: bozze.map((b, i) => {
          return {
            disciplina: b.disciplinaNombre,
            plan: b.planNombre,
            precio: b.planPrecio,
            horarios: b.horariosLabels,
            alumna: b.esNinas && alumnas[i]?.nombre
              ? { nombre: alumnas[i].nombre, apellido: alumnas[i].apellido }
              : undefined,
          };
        }),
      };
      fetch("/api/send-confirmation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailPayload),
      }).catch(() => {}); // fire-and-forget

      onConfirmado(cId, firstId);
    } catch {
      setError("Ha ocurrido un error. Por favor, inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 pb-16">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-8">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm transition-colors hover:opacity-70" style={{ color: "#56423d" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Volver
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Form */}
        <div className="lg:col-span-3 space-y-6">
          <h2 className="text-4xl" style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", color: "#7d2b13" }}>
            Datos personales
          </h2>

          {/* Contacto — bloqueado si segunda inscripción */}
          {segundaInscripcion ? (
            <div className="rounded-2xl p-5 border space-y-1" style={{ backgroundColor: "#fff1e9", borderColor: "#dcc1b9" }}>
              <p className="text-xs tracking-widest uppercase font-semibold mb-3" style={{ color: "#7d2b13", fontFamily: "var(--font-montserrat)" }}>Tus datos</p>
              <p className="text-sm font-medium" style={{ color: "#25190f" }}>{estado.nombre} {estado.apellido}</p>
              <p className="text-sm" style={{ color: "#56423d" }}>{estado.email}</p>
              {estado.telefono && <p className="text-sm" style={{ color: "#56423d" }}>{estado.telefono}</p>}
            </div>
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

          {/* Alumna por cada bozza de niñas */}
          {bozzeNinas.map(({ bozza, idx }) => (
            <div key={idx}>
              <p className="text-xs tracking-widest uppercase font-semibold mb-3" style={{ color: "#7d2b13", fontFamily: "var(--font-montserrat)" }}>
                Alumna — {bozza.disciplinaNombre}
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Nombre alumna" type="text" value={alumnas[idx]?.nombre ?? ""} onChange={(v) => updateAlumna(idx, "nombre", v)} placeholder="María" />
                <Field label="Apellido alumna" type="text" value={alumnas[idx]?.apellido ?? ""} onChange={(v) => updateAlumna(idx, "apellido", v)} placeholder="García" />
              </div>
            </div>
          ))}

          {/* Método de pago */}
          <div>
            <h3 className="text-2xl mb-4" style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", color: "#7d2b13" }}>Método de pago</h3>
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
                      <span className="absolute top-1.5 right-2 text-[10px] tracking-wider uppercase font-semibold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#dcc1b9", color: "#56423d" }}>
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
          <div className="rounded-3xl border p-6 sticky top-24" style={{ backgroundColor: "#ffffff", borderColor: "#dcc1b9" }}>
            <h3 className="text-xl mb-4" style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", color: "#7d2b13" }}>Resumen</h3>

            <div className="space-y-3 mb-5">
              {bozze.map((b, i) => (
                <div key={i} className="pb-3 border-b" style={{ borderColor: "#dcc1b9" }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium" style={{ color: "#25190f" }}>{b.disciplinaNombre}</p>
                      <p className="text-xs" style={{ color: "#89726c" }}>{b.planNombre} · {b.horarios.length} horario{b.horarios.length !== 1 ? "s" : ""}</p>
                    </div>
                    <p className="text-sm font-semibold" style={{ color: "#7d2b13" }}>{b.planPrecio}€/mes</p>
                  </div>
                </div>
              ))}

              {/* Matrícula */}
              <div className="rounded-2xl p-4 border" style={{ backgroundColor: "#fff8f5", borderColor: "#dcc1b9" }}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "#25190f" }}>Matrícula</p>
                    <p className="text-xs leading-snug mt-0.5" style={{ color: "#56423d" }}>
                      Incluye evaluación inicial, plaza reservada y material de bienvenida
                    </p>
                    <p className="text-xs mt-1 italic" style={{ color: "#89726c" }}>
                      Pago único — no se repite mientras sigas con nosotros
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    {matriculaOferta && (
                      <p className="text-xs line-through mb-0.5" style={{ color: "#bcb0ab" }}>50€</p>
                    )}
                    <p className="text-sm font-bold" style={{ color: "#7d2b13" }}>{matriculaPrecio}€</p>
                    {matriculaOferta && (
                      <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full" style={{ backgroundColor: "#7d2b13", color: "#fff" }}>
                        Hasta 31 jul
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-end pt-1 border-t" style={{ borderColor: "#dcc1b9" }}>
                <div>
                  <span className="text-sm" style={{ color: "#56423d" }}>Total mensual</span>
                  <p className="text-xs" style={{ color: "#89726c" }}>+ {matriculaPrecio}€ matrícula (1ª vez)</p>
                </div>
                <span className="text-3xl" style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", color: "#7d2b13" }}>{totalMensual}€</span>
              </div>
            </div>

            {modalPrivacidad && <ModalPrivacidad onClose={() => setModalPrivacidad(false)} onAceptar={() => setRgpdAceptado(true)} />}

            <label className="flex items-start gap-2.5 mb-4 cursor-pointer">
              <input type="checkbox" checked={rgpdAceptado} onChange={(e) => setRgpdAceptado(e.target.checked)} className="mt-0.5 shrink-0 accent-[#7d2b13]" />
              <span className="text-xs leading-snug" style={{ color: "#56423d" }}>
                Acepto el tratamiento de mis datos personales según la{" "}
                <button type="button" onClick={() => setModalPrivacidad(true)} className="underline hover:opacity-70" style={{ color: "#7d2b13" }}>
                  política de privacidad
                </button>
              </span>
            </label>

            {error && <p className="text-xs text-red-600 text-center mb-3">{error}</p>}

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
              {enviando ? "Enviando..." : bozze.length > 1 ? `Confirmar ${bozze.length} inscripciones` : "Confirmar inscripción"}
            </button>

            <p className="text-xs text-center mt-3" style={{ color: "#89726c" }}>Sin compromiso. Cancela cuando quieras.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, type, value, onChange, placeholder }: {
  label: string; type: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs tracking-widest uppercase mb-2" style={{ color: "#56423d", fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif" }}>
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border px-4 py-3 text-sm transition-colors focus:outline-none"
        style={{ borderColor: "#dcc1b9", backgroundColor: "#fff1e9", color: "#25190f", fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif" }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "#7d2b13")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "#dcc1b9")}
      />
    </div>
  );
}
