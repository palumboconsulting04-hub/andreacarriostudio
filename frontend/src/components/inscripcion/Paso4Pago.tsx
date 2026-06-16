"use client";

import { useState } from "react";
import { loadStripe, type Appearance } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { findCoupon, applyCoupon, type Coupon } from "@/lib/coupons";
import type { InscripcionState, MetodoPago, BozzaIscrizione } from "./types";
import type { InscripcionEmailData } from "@/app/api/send-confirmation/route";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

const stripeAppearance: Appearance = {
  theme: "stripe",
  variables: {
    colorPrimary: "#7d2b13",
    colorBackground: "#fff1e9",
    colorText: "#25190f",
    colorDanger: "#df1b41",
    colorTextSecondary: "#56423d",
    borderRadius: "12px",
    fontSizeBase: "16px",
  },
};

interface Props {
  estado: InscripcionState;
  bozze: BozzaIscrizione[];
  onChange: (updates: Partial<InscripcionState>) => void;
  onBack: () => void;
  onConfirmado: (contattoId: string, iscrizioneId: string) => void;
  existingContattoId?: string | null;
}

const metodosPago: { id: MetodoPago; label: string; proximamente?: boolean }[] = [
  { id: "tarjeta", label: "Tarjeta de crédito" },
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
          <div><p className="font-semibold mb-1" style={{ color: "#25190f" }}>Responsable del tratamiento</p><p>Andrea Carrió, titular de Andrea Carrió Studio, C/ Motilla del Palancar 34, Alfahuir (Valencia). Contacto: andreacarriostudio@gmail.com</p></div>
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

// Aviso cuando se detecta una posible inscripción duplicada (mismo email + misma
// clase en las últimas 48h). No bloquea: la madre decide si continúa.
function ModalDuplicado({ disciplinas, onCancelar, onContinuar }: { disciplinas: string[]; onCancelar: () => void; onContinuar: () => void }) {
  const clase = disciplinas.length > 0 ? disciplinas.join(", ") : "esta clase";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: "rgba(37,25,15,0.6)" }}>
      <div className="relative w-full max-w-md rounded-3xl p-8" style={{ backgroundColor: "#fff8f5", boxShadow: "0 8px 40px rgba(37,25,15,0.2)" }}>
        <h2 className="text-2xl mb-4" style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", color: "#7d2b13" }}>
          Un momento 🤍
        </h2>
        <p className="text-sm leading-relaxed mb-2" style={{ color: "#56423d" }}>
          Me consta que ya hiciste esta inscripción para <strong>{clase}</strong> hace unos minutos y el pago se completó correctamente.
        </p>
        <p className="text-sm leading-relaxed mb-6" style={{ color: "#56423d" }}>
          Si tu primer pago salió bien, <strong>no hace falta pagar otra vez</strong>. Si tienes dudas, escríbeme y lo reviso enseguida.
        </p>
        <button onClick={onCancelar} className="w-full py-3 rounded-full text-sm font-semibold tracking-widest uppercase mb-2" style={{ backgroundColor: "#7d2b13", color: "#ffffff" }}>
          No pagar otra vez
        </button>
        <button onClick={onContinuar} className="w-full py-2 text-xs tracking-widest uppercase hover:opacity-70" style={{ color: "#89726c" }}>
          Continuar igualmente
        </button>
      </div>
    </div>
  );
}

// --- Stripe payment fase (inside Elements provider) ---

interface SavedPagoData {
  contattoId: string;
  iscrizioneId: string;
  emailPayload: InscripcionEmailData;
}

interface StripePaymentFaseProps {
  bozze: BozzaIscrizione[];
  totalMensual: number;
  totalMatricula: number;
  matriculaOferta: boolean;
  matriculaPrecio: number;
  totalPersonas: number;
  couponAplicado: Coupon | null;
  savedData: SavedPagoData;
  onConfirmado: (contattoId: string, iscrizioneId: string) => void;
  onBack: () => void;
}

function StripePaymentFase({
  bozze,
  totalMensual,
  totalMatricula,
  matriculaOferta,
  matriculaPrecio,
  totalPersonas,
  couponAplicado,
  savedData,
  onConfirmado,
  onBack,
}: StripePaymentFaseProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [pagando, setPagando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hoy solo se cobra la matrícula (el cupón se aplica a la matrícula).
  // El bono mensual se cobra automáticamente a partir del 1 de septiembre.
  const matriculaHoy = applyCoupon(totalMatricula, couponAplicado);

  const handlePagar = async () => {
    if (!stripe || !elements) return;
    setPagando(true);
    setError(null);

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: window.location.href,
        payment_method_data: {
          billing_details: { email: savedData.emailPayload.email },
        },
      },
      redirect: "if_required",
    });

    if (confirmError) {
      setError(confirmError.message ?? "Error al procesar el pago.");
      setPagando(false);
      return;
    }

    fetch("/api/send-confirmation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(savedData.emailPayload),
    }).catch(() => {});

    onConfirmado(savedData.contattoId, savedData.iscrizioneId);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 pb-16">
      <div className="flex items-center gap-2 mb-8">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm transition-colors hover:opacity-70" style={{ color: "#56423d" }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Volver
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Stripe form */}
        <div className="lg:col-span-3 space-y-6">
          <h2 className="text-4xl" style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", color: "#7d2b13" }}>
            Pago con tarjeta
          </h2>

          <div className="rounded-2xl border p-5" style={{ borderColor: "#dcc1b9", backgroundColor: "#ffffff" }}>
            <PaymentElement
              options={{
                layout: "tabs",
                fields: { billingDetails: { email: "never" } },
              }}
            />
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button
            onClick={handlePagar}
            disabled={!stripe || !elements || pagando}
            className="w-full py-4 rounded-full text-sm tracking-widest uppercase font-semibold transition-colors"
            style={{
              backgroundColor: !stripe || !elements || pagando ? "#dcc1b9" : "#7d2b13",
              color: "#ffffff",
              cursor: !stripe || !elements || pagando ? "not-allowed" : "pointer",
            }}
          >
            {pagando ? "Procesando..." : `Pagar matrícula ${matriculaHoy}€`}
          </button>

          <p className="text-xs text-center leading-relaxed" style={{ color: "#89726c" }}>
            Hoy solo pagas la matrícula. El bono ({totalMensual}€/mes) se cobrará
            automáticamente en esta tarjeta a partir del <strong>1 de septiembre</strong> y
            después cada mes. Puedes cancelar cuando quieras escribiendo a Andrea.
            <br />Pago seguro con cifrado SSL.
          </p>
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

              <div className="rounded-2xl p-4 border" style={{ backgroundColor: "#fff8f5", borderColor: "#dcc1b9" }}>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "#25190f" }}>Matrícula</p>
                    <p className="text-xs leading-snug mt-0.5" style={{ color: "#56423d" }}>
                      Incluye evaluación inicial, plaza reservada y material de bienvenida
                    </p>
                    <p className="text-xs mt-1 italic" style={{ color: "#89726c" }}>
                      Pago anual — una sola vez por curso, no es una cuota mensual
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    {matriculaOferta && totalPersonas === 1 && (
                      <p className="text-xs line-through mb-0.5" style={{ color: "#bcb0ab" }}>50€</p>
                    )}
                    <p className="text-sm font-bold" style={{ color: "#7d2b13" }}>{totalMatricula}€</p>
                    {totalPersonas > 1 && (
                      <p className="text-xs mt-0.5" style={{ color: "#89726c" }}>{totalPersonas} personas × {matriculaPrecio}€</p>
                    )}
                    {matriculaOferta && (
                      <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full mt-1 inline-block" style={{ backgroundColor: "#7d2b13", color: "#fff" }}>
                        Hasta 31 jul
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {couponAplicado && (
                <div className="flex justify-between items-center pt-1">
                  <span className="text-xs font-semibold" style={{ color: "#7d2b13" }}>
                    Cupón {couponAplicado.code}
                  </span>
                  <span className="text-xs font-semibold" style={{ color: "#7d2b13" }}>
                    −{Math.round(couponAplicado.descuento * 100)}%
                  </span>
                </div>
              )}

              <div className="flex justify-between items-end pt-1 border-t" style={{ borderColor: "#dcc1b9" }}>
                <div>
                  <span className="text-sm font-semibold" style={{ color: "#25190f" }}>Hoy pagas (matrícula)</span>
                  <p className="text-xs" style={{ color: "#89726c" }}>Bono {totalMensual}€/mes desde el 1 de sept</p>
                </div>
                <div className="text-right">
                  {couponAplicado && (
                    <span className="block text-sm line-through" style={{ color: "#bcb0ab" }}>{totalMatricula}€</span>
                  )}
                  <span className="text-3xl" style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", color: "#7d2b13" }}>{matriculaHoy}€</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main component ---

export default function Paso4Pago({ estado, bozze, onChange, onBack, onConfirmado, existingContattoId }: Props) {
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicadoAviso, setDuplicadoAviso] = useState<string[] | null>(null);
  const [rgpdAceptado, setRgpdAceptado] = useState(false);
  const [autorizaCobro, setAutorizaCobro] = useState(false);
  const [modalPrivacidad, setModalPrivacidad] = useState(false);
  const [alumnas, setAlumnas] = useState<{ nombre: string; apellido: string }[]>(
    bozze.map(() => ({ nombre: "", apellido: "" }))
  );

  // Stripe payment fase
  const [fase, setFase] = useState<"datos" | "pago">("datos");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [savedPagoData, setSavedPagoData] = useState<SavedPagoData | null>(null);

  // Cupón de descuento (opcional)
  const [couponInput, setCouponInput] = useState("");
  const [couponAplicado, setCouponAplicado] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  const segundaInscripcion = !!existingContattoId;
  const bozzeNinas = bozze.map((b, i) => ({ bozza: b, idx: i })).filter(({ bozza }) => bozza.esNinas);
  const totalMensual = bozze.reduce((s, b) => s + b.planPrecio, 0);

  const MATRICULA_OFERTA_HASTA = new Date("2026-07-31T23:59:59");
  const matriculaPrecio = new Date() <= MATRICULA_OFERTA_HASTA ? 35 : 50;
  const matriculaOferta = new Date() <= MATRICULA_OFERTA_HASTA;

  const hasAdult = bozze.some(b => !b.esNinas);
  const uniqueNinas = new Set(
    bozze.map((b, i) => b.esNinas ? `${alumnas[i]?.nombre ?? ""}_${alumnas[i]?.apellido ?? ""}` : null)
      .filter(Boolean)
  );
  const totalPersonas = (hasAdult ? 1 : 0) + uniqueNinas.size;
  const totalMatricula = totalPersonas * matriculaPrecio;

  // Lo que se cobra HOY: solo la matrícula (con el cupón aplicado, si lo hay).
  const matriculaFinal = applyCoupon(totalMatricula, couponAplicado);

  const handleAplicarCoupon = () => {
    const found = findCoupon(couponInput);
    if (found) {
      setCouponAplicado(found);
      setCouponError(null);
    } else {
      setCouponAplicado(null);
      setCouponError("Código no válido");
    }
  };

  const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(estado.email.trim());

  const contactoOk = segundaInscripcion
    ? true
    : estado.nombre.trim() !== "" && estado.apellido.trim() !== "" && emailValido;

  const alumnaOk = bozzeNinas.every(({ idx }) =>
    alumnas[idx]?.nombre.trim() !== "" && alumnas[idx]?.apellido.trim() !== ""
  );

  const puedeConfirmar = contactoOk && alumnaOk && rgpdAceptado && autorizaCobro;

  const updateAlumna = (idx: number, field: "nombre" | "apellido", value: string) => {
    setAlumnas(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  };

  const buildEmailPayload = (): InscripcionEmailData => ({
    email: estado.email,
    nombre: estado.nombre,
    apellido: estado.apellido,
    totalMensual,
    matricula: totalMatricula,
    metodoPago: estado.metodoPago,
    notifyAdmin: true,
    inscripciones: bozze.map((b, i) => ({
      disciplina: b.disciplinaNombre,
      plan: b.planNombre,
      precio: b.planPrecio,
      horarios: b.horariosLabels,
      alumna: b.esNinas && alumnas[i]?.nombre
        ? { nombre: alumnas[i].nombre, apellido: alumnas[i].apellido }
        : undefined,
    })),
  });

  const saveToSupabase = async (stripePaymentIntentId?: string, stripeCustomerId?: string) => {
    // Construye la lista de inscripciones (con su matrícula por persona) y la
    // persiste en el servidor (service-role), sin escribir con la clave pública.
    let adultCharged = false;
    const ninasCharged = new Set<string>();
    const inscripciones = bozze.map((b, i) => {
      let thisMatricula = 0;
      if (b.esNinas) {
        const key = `${alumnas[i]?.nombre ?? ""}_${alumnas[i]?.apellido ?? ""}`;
        if (!ninasCharged.has(key)) { thisMatricula = matriculaPrecio; ninasCharged.add(key); }
      } else {
        if (!adultCharged) { thisMatricula = matriculaPrecio; adultCharged = true; }
      }
      return {
        disciplina_id: b.disciplinaId,
        piano_id: b.planId,
        nome: estado.nombre,
        cognome: estado.apellido,
        email: estado.email,
        telefono: estado.telefono || null,
        metodo_pagamento: estado.metodoPago,
        nome_alumna: b.esNinas ? (alumnas[i]?.nombre ?? "") : "",
        cognome_alumna: b.esNinas ? (alumnas[i]?.apellido ?? "") : "",
        matricula: thisMatricula,
        horarios: b.horarios,
      };
    });

    const res = await fetch("/api/inscripcion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contatto: { nome: estado.nombre, cognome: estado.apellido, email: estado.email, telefono: estado.telefono || null },
        existingContattoId: existingContattoId ?? null,
        stripePaymentIntentId,
        stripeCustomerId,
        inscripciones,
      }),
    });
    if (!res.ok) throw new Error("No se pudo guardar la inscripción");
    const { cId, firstId } = await res.json();
    return { cId, firstId };
  };

  const handleConfirmar = async (forzar = false) => {
    if (!puedeConfirmar || enviando) return;
    setEnviando(true);
    setError(null);

    try {
      if (estado.metodoPago === "tarjeta") {
        // 0. Guardia anti-duplicado: si ya pagó esta misma clase hace un rato,
        //    avisamos antes de cobrar otra vez (salvo que ya haya confirmado seguir).
        if (!forzar) {
          const items = bozze.map(b => ({ disciplina_id: b.disciplinaId, piano_id: b.planId }));
          const dupRes = await fetch("/api/check-duplicado", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: estado.email, items }),
          });
          const dup = await dupRes.json().catch(() => ({ duplicate: false }));
          if (dup.duplicate) {
            setDuplicadoAviso(dup.disciplinas ?? []);
            setEnviando(false);
            return;
          }
        }

        // 1. Cobrar la matrícula hoy y guardar la tarjeta.
        //    Al confirmarse el pago, el webhook crea la suscripción del bono (1 sept).
        const res = await fetch("/api/create-subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matriculaEur: totalMatricula,
            email: estado.email,
            nombre: `${estado.nombre} ${estado.apellido}`.trim(),
            description: `Matrícula — ${bozze.map(b => b.disciplinaNombre).join(", ")}`,
            couponCode: couponAplicado?.code,
          }),
        });
        const { clientSecret: cs, paymentIntentId: piId, customerId, error: apiErr } = await res.json();
        if (apiErr || !cs) throw new Error(apiErr || "Error al crear el pago");

        // 2. Guardar inscripciones con el PaymentIntent y el cliente de Stripe.
        const { cId, firstId } = await saveToSupabase(piId, customerId);

        // 3. Pasar a la fase de pago (PaymentElement).
        setSavedPagoData({ contattoId: cId, iscrizioneId: firstId, emailPayload: buildEmailPayload() });
        setClientSecret(cs);
        setFase("pago");
      } else {
        // en-escuela: save + email + done
        const { cId, firstId } = await saveToSupabase();

        fetch("/api/send-confirmation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildEmailPayload()),
        }).catch(() => {});

        onConfirmado(cId, firstId);
      }
    } catch {
      setError("Ha ocurrido un error. Por favor, inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  // Render Stripe payment fase
  if (fase === "pago" && clientSecret && savedPagoData) {
    return (
      <Elements stripe={stripePromise} options={{ clientSecret, appearance: stripeAppearance }}>
        <StripePaymentFase
          bozze={bozze}
          totalMensual={totalMensual}
          totalMatricula={totalMatricula}
          matriculaOferta={matriculaOferta}
          matriculaPrecio={matriculaPrecio}
          totalPersonas={totalPersonas}
          couponAplicado={couponAplicado}
          savedData={savedPagoData}
          onConfirmado={onConfirmado}
          onBack={() => setFase("datos")}
        />
      </Elements>
    );
  }

  // Render datos fase
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

          {/* Contacto */}
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

          {/* Alumna per bozza niñas */}
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
                      Pago anual — una sola vez por curso, no es una cuota mensual
                    </p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    {matriculaOferta && totalPersonas === 1 && (
                      <p className="text-xs line-through mb-0.5" style={{ color: "#bcb0ab" }}>50€</p>
                    )}
                    <p className="text-sm font-bold" style={{ color: "#7d2b13" }}>{totalMatricula}€</p>
                    {totalPersonas > 1 && (
                      <p className="text-xs mt-0.5" style={{ color: "#89726c" }}>{totalPersonas} personas × {matriculaPrecio}€</p>
                    )}
                    {matriculaOferta && (
                      <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full mt-1 inline-block" style={{ backgroundColor: "#7d2b13", color: "#fff" }}>
                        Hasta 31 jul
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Cupón de descuento */}
              <div className="pt-1">
                {couponAplicado ? (
                  <div className="flex items-center justify-between rounded-xl px-3 py-2.5" style={{ backgroundColor: "#ffdbd1" }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold" style={{ color: "#7d2b13" }}>
                        {couponAplicado.code} · −{Math.round(couponAplicado.descuento * 100)}%
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setCouponAplicado(null); setCouponInput(""); }}
                      className="text-xs underline hover:opacity-70"
                      style={{ color: "#7d2b13" }}
                    >
                      Quitar
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => { setCouponInput(e.target.value); setCouponError(null); }}
                      placeholder="Código de descuento"
                      className="flex-1 min-w-0 rounded-xl border px-3 py-2.5 text-sm focus:outline-none"
                      style={{ borderColor: "#dcc1b9", backgroundColor: "#fff1e9", color: "#25190f", fontSize: "16px", fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif" }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = "#7d2b13")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "#dcc1b9")}
                    />
                    <button
                      type="button"
                      onClick={handleAplicarCoupon}
                      disabled={couponInput.trim() === ""}
                      className="shrink-0 px-4 py-2.5 rounded-xl text-xs font-semibold tracking-widest uppercase transition-colors"
                      style={{
                        backgroundColor: couponInput.trim() === "" ? "#dcc1b9" : "#7d2b13",
                        color: "#ffffff",
                        cursor: couponInput.trim() === "" ? "not-allowed" : "pointer",
                      }}
                    >
                      Aplicar
                    </button>
                  </div>
                )}
                {couponError && <p className="text-xs text-red-600 mt-2">{couponError}</p>}
              </div>

              <div className="flex justify-between items-end pt-1 border-t" style={{ borderColor: "#dcc1b9" }}>
                <div>
                  <span className="text-sm font-semibold" style={{ color: "#25190f" }}>Hoy pagas (matrícula)</span>
                  <p className="text-xs" style={{ color: "#89726c" }}>Luego el bono: {totalMensual}€/mes desde el 1 de septiembre</p>
                </div>
                <div className="text-right">
                  {couponAplicado && (
                    <span className="block text-sm line-through" style={{ color: "#bcb0ab" }}>{totalMatricula}€</span>
                  )}
                  <span className="text-3xl" style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", color: "#7d2b13" }}>{matriculaFinal}€</span>
                </div>
              </div>
            </div>

            {modalPrivacidad && <ModalPrivacidad onClose={() => setModalPrivacidad(false)} onAceptar={() => setRgpdAceptado(true)} />}

            {duplicadoAviso && (
              <ModalDuplicado
                disciplinas={duplicadoAviso}
                onCancelar={() => setDuplicadoAviso(null)}
                onContinuar={() => { setDuplicadoAviso(null); handleConfirmar(true); }}
              />
            )}

            <label className="flex items-start gap-2.5 mb-4 cursor-pointer">
              <input type="checkbox" checked={rgpdAceptado} onChange={(e) => setRgpdAceptado(e.target.checked)} className="mt-0.5 shrink-0 accent-[#7d2b13]" />
              <span className="text-xs leading-snug" style={{ color: "#56423d" }}>
                Acepto el tratamiento de mis datos personales según la{" "}
                <button type="button" onClick={() => setModalPrivacidad(true)} className="underline hover:opacity-70" style={{ color: "#7d2b13" }}>
                  política de privacidad
                </button>
              </span>
            </label>

            <label className="flex items-start gap-2.5 mb-4 cursor-pointer">
              <input type="checkbox" checked={autorizaCobro} onChange={(e) => setAutorizaCobro(e.target.checked)} className="mt-0.5 shrink-0 accent-[#7d2b13]" />
              <span className="text-xs leading-snug" style={{ color: "#56423d" }}>
                Autorizo que hoy se cobre la matrícula y que, a partir del{" "}
                <strong>1 de septiembre</strong>, se cobre automáticamente el bono mensual
                ({totalMensual}€/mes) en mi tarjeta hasta que solicite la baja.
              </span>
            </label>

            {error && <p className="text-xs text-red-600 text-center mb-3">{error}</p>}

            <button
              onClick={() => handleConfirmar()}
              disabled={!puedeConfirmar || enviando}
              className="w-full py-4 rounded-full text-sm tracking-widest uppercase font-semibold transition-colors"
              style={{
                backgroundColor: puedeConfirmar && !enviando ? "#7d2b13" : "#dcc1b9",
                color: "#ffffff",
                cursor: puedeConfirmar && !enviando ? "pointer" : "not-allowed",
              }}
            >
              {enviando
                ? "Preparando pago..."
                : estado.metodoPago === "tarjeta"
                  ? bozze.length > 1 ? `Continuar al pago (${bozze.length} inscripciones)` : "Continuar al pago"
                  : bozze.length > 1 ? `Confirmar ${bozze.length} inscripciones` : "Confirmar inscripción"}
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
        // fontSize 16px evita el zoom automático del móvil al enfocar el campo.
        style={{ borderColor: "#dcc1b9", backgroundColor: "#fff1e9", color: "#25190f", fontSize: "16px", fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif" }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "#7d2b13")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "#dcc1b9")}
      />
    </div>
  );
}
