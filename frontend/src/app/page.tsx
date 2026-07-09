"use client";

import { useState, useEffect, useRef } from "react";
import Script from "next/script";
import { FB_PIXEL_ID, fbTrack } from "@/lib/meta";
import StepIndicator from "@/components/inscripcion/StepIndicator";
import Paso1Disciplina from "@/components/inscripcion/Paso1Disciplina";
import Paso2Plan from "@/components/inscripcion/Paso2Plan";
import Paso3Horarios from "@/components/inscripcion/Paso3Horarios";
import Paso4Pago from "@/components/inscripcion/Paso4Pago";
import Paso4CrossSell from "@/components/inscripcion/Paso4CrossSell";
import Paso5Gracias from "@/components/inscripcion/Paso5Gracias";
import FooterLegal from "@/components/FooterLegal";
import type { InscripcionState, BozzaIscrizione, Disciplina, Plan, HorarioSlot, DisciplinaId, PlanId } from "@/components/inscripcion/types";
import { fetchDiscipline, fetchPiani, fetchOrari } from "@/lib/queries";

const DISCIPLINAS_NINAS = new Set<DisciplinaId>(["pre-ballet", "ballet-i", "ballet-ii"]);
// Barre y Pilates ofrecen también bonos (créditos) además de la mensualidad.
const BONO_DISCIPLINAS = new Set<DisciplinaId>(["barre-fit", "pilates-mat"]);

const estadoInicial: InscripcionState = {
  disciplina: null,
  plan: null,
  horarios: [],
  nombre: "",
  apellido: "",
  email: "",
  telefono: "",
  metodoPago: "tarjeta",
  nombreAlumna: "",
  apellidoAlumna: "",
};

function continuarEnabled(paso: number, estado: InscripcionState): boolean {
  if (paso === 1) return estado.disciplina !== null;
  if (paso === 2) return estado.plan !== null;
  if (paso === 3) return estado.horarios.length > 0;
  return false; // paso 4+ handled by component buttons
}

export default function Home() {
  const [paso, setPaso] = useState(1);
  // Bifurcación mensualidad/bono (solo Barre y Pilates), entre el paso 1 y el 2.
  const [fork, setFork] = useState<DisciplinaId | null>(null);
  const [estado, setEstado] = useState<InscripcionState>(estadoInicial);
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [slots, setSlots] = useState<HorarioSlot[]>([]);
  const [cargando, setCargando] = useState(true);
  const [iscrizioneId, setIscrizioneId] = useState<string | null>(null);
  const [contattoId, setContattoId] = useState<string | null>(null);
  const [bozze, setBozze] = useState<BozzaIscrizione[]>([]);

  useEffect(() => {
    fetchDiscipline()
      .then(setDisciplinas)
      .finally(() => setCargando(false));
  }, []);

  // ── Embudo interno (anónimo): registra a qué paso llega cada sesión ──
  const sessionIdRef = useRef<string>("");
  const origenRef = useRef<"ads" | "directo">("directo");
  const funnelLogged = useRef<Set<string>>(new Set());
  useEffect(() => {
    let sid = sessionStorage.getItem("acs_fsid");
    if (!sid) {
      sid = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      sessionStorage.setItem("acs_fsid", sid);
    }
    sessionIdRef.current = sid;

    // Origen: anuncios de Meta (fbclid o UTM de pago) vs. tráfico directo.
    const p = new URLSearchParams(window.location.search);
    const src = (p.get("utm_source") || "").toLowerCase();
    const med = (p.get("utm_medium") || "").toLowerCase();
    if (
      p.get("fbclid") ||
      ["facebook", "fb", "ig", "instagram", "meta"].includes(src) ||
      ["paid", "cpc", "ppc", "paid_social"].includes(med)
    ) {
      origenRef.current = "ads";
    }
  }, []);
  useEffect(() => {
    const map: Record<number, string> = {
      1: "paso1_disciplina", 2: "paso2_plan", 3: "paso3_horarios",
      4: "paso4_crosssell", 5: "paso5_pago", 6: "compra",
    };
    const step = map[paso];
    if (!step || !sessionIdRef.current || funnelLogged.current.has(step)) return;
    funnelLogged.current.add(step);
    fetch("/api/funnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionIdRef.current, step, origen: origenRef.current }),
    }).catch(() => {});
  }, [paso]);

  // ── Meta Pixel: eventos del funnel de inscripción ──
  const checkoutFired = useRef(false);
  useEffect(() => {
    fbTrack("ViewContent", { content_name: "Funnel inscripción" });
  }, []);
  useEffect(() => {
    // Al llegar al paso de datos + pago: InitiateCheckout (una sola vez).
    if (paso === 5 && !checkoutFired.current) {
      checkoutFired.current = true;
      fbTrack("InitiateCheckout", { content_name: "Datos y pago" });
    }
  }, [paso]);

  const update = (updates: Partial<InscripcionState>) =>
    setEstado((e) => ({ ...e, ...updates }));

  const buildBozzaAttuale = (): BozzaIscrizione | null => {
    if (!estado.disciplina || !estado.plan || !disciplinaObj || !planObj) return null;
    return {
      disciplinaId: estado.disciplina,
      disciplinaNombre: disciplinaObj.nombre,
      planId: estado.plan,
      planNombre: planObj.nombre,
      planPrecio: planObj.precio,
      horarios: [...estado.horarios],
      horariosLabels: estado.horarios.map(id => {
        const s = slots.find(sl => sl.id === id);
        return s ? `${s.dia} ${s.hora}–${s.horaFin}` : "";
      }).filter(Boolean),
      esNinas: DISCIPLINAS_NINAS.has(estado.disciplina),
    };
  };

  const handleCrossSellContinuar = () => {
    const bozza = buildBozzaAttuale();
    if (!bozza) return;
    setBozze(prev => [...prev, bozza]);
    setPaso(5);
  };

  const handleCrossSellAgregar = () => {
    const bozza = buildBozzaAttuale();
    if (!bozza) return;
    setBozze(prev => [...prev, bozza]);
    setEstado(e => ({ ...e, disciplina: null, plan: null, horarios: [], nombreAlumna: "", apellidoAlumna: "" }));
    setPlanes([]);
    setSlots([]);
    setPaso(1);
  };

  const disciplinaObj = disciplinas.find((d) => d.id === estado.disciplina) ?? null;
  const planObj = planes.find((p) => p.id === estado.plan) ?? null;

  const handleDisciplinaSelect = async (id: DisciplinaId) => {
    update({ disciplina: id, plan: null, horarios: [] });
    setCargando(true);
    try {
      const [newPlanes, newSlots] = await Promise.all([
        fetchPiani(id),
        fetchOrari(id),
      ]);
      setPlanes(newPlanes);
      setSlots(newSlots);
      // Barre/Pilates → primero elegir mensualidad o bono. El resto va directo al plan.
      if (BONO_DISCIPLINAS.has(id)) setFork(id);
      else setPaso(2);
    } finally {
      setCargando(false);
    }
  };

  const handleContinuar = () => {
    if (paso < 4 && continuarEnabled(paso, estado)) setPaso(paso + 1);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: "#fff8f5", color: "#25190f" }}>

      {/* ── Meta Pixel (base) — dispara PageView al cargar el funnel ── */}
      <Script id="fb-pixel-funnel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${FB_PIXEL_ID}');
        fbq('track', 'PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img height="1" width="1" style={{ display: "none" }} alt="" src={`https://www.facebook.com/tr?id=${FB_PIXEL_ID}&ev=PageView&noscript=1`} />
      </noscript>

      {/* Mobile top bar */}
      <div className="md:hidden flex items-center px-5 py-3 border-b" style={{ borderColor: "#dcc1b9", backgroundColor: "#fff1e9" }}>
        <a
          href="https://andreacarriostudio.es/"
          className="flex items-center gap-1.5 text-xs transition-opacity hover:opacity-70"
          style={{ color: "#89726c", fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif" }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
            <path d="M11 6.5H2M5.5 3L2 6.5l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Volver a la web
        </a>
      </div>

      {/* Sidebar + content */}
      <div className="flex flex-1">
        <StepIndicator pasoActual={paso} />


        <main className="flex-1 min-w-0 py-8">
          {cargando && (
            <div className="flex items-center justify-center h-64">
              <div
                className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: "#7d2b13", borderTopColor: "transparent" }}
              />
            </div>
          )}

          {!cargando && paso === 1 && !fork && (
            <Paso1Disciplina
              disciplinas={disciplinas}
              value={estado.disciplina}
              onSelect={handleDisciplinaSelect}
            />
          )}

          {!cargando && paso === 1 && fork && (
            <div className="max-w-2xl mx-auto px-6 pb-16">
              <div className="flex items-center gap-2 mb-8">
                <button onClick={() => { setFork(null); update({ disciplina: null, plan: null, horarios: [] }); }} className="flex items-center gap-1.5 font-body text-sm text-texto-muted hover:text-siena transition-colors">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  Volver
                </button>
                <span className="text-outline-light">/</span>
                <span className="font-body text-sm text-texto">{disciplinaObj?.nombre}</span>
              </div>

              <div className="text-center mb-10">
                <h2 className="font-display text-4xl sm:text-5xl text-siena mb-3">¿Cómo prefieres venir?</h2>
                <p className="font-body text-texto-muted text-base">Elige la modalidad que mejor encaja con tu ritmo de vida.</p>
              </div>

              <div className="grid gap-5 grid-cols-1 sm:grid-cols-2">
                {/* Mensualidad (destacada) */}
                <button onClick={() => { setFork(null); setPaso(2); }} className="group relative text-left rounded-3xl p-7 border transition-all duration-300 hover:-translate-y-1 bg-siena border-siena text-white shadow-lg focus:outline-none">
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-terracota-light text-texto font-body font-semibold tracking-widest uppercase px-3 py-1 rounded-full shadow" style={{ fontSize: "10px" }}>Recomendado</span>
                  <div className="text-3xl mb-3">🔁</div>
                  <p className="font-display text-2xl font-semibold text-white mb-1">Mensualidad</p>
                  <p className="font-body text-sm text-siena-pale mb-5">Para quien viene con rutina</p>
                  <ul className="space-y-2.5 mb-7">
                    {["Plaza fija cada semana", "El mejor precio por clase", "Progreso constante"].map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0 text-siena-light"><path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        <span className="font-body text-sm leading-snug text-siena-pale">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <span className="inline-flex items-center justify-center w-full gap-2 py-3 rounded-full font-body text-sm font-semibold tracking-wider uppercase bg-white text-siena group-hover:bg-siena-pale transition-all">
                    Elegir mensualidad
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="transition-transform group-hover:translate-x-1"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                </button>

                {/* Bono flexible */}
                <button onClick={() => { window.location.href = `/comprar-bono?disciplina=${fork}`; }} className="group relative text-left rounded-3xl p-7 border transition-all duration-300 hover:-translate-y-1 bg-white border-outline-light hover:border-siena-pale shadow-sm hover:shadow-md focus:outline-none">
                  <div className="text-3xl mb-3">🎟️</div>
                  <p className="font-display text-2xl font-semibold text-siena mb-1">Bono flexible</p>
                  <p className="font-body text-sm text-texto-muted mb-5">Para quien improvisa</p>
                  <ul className="space-y-2.5 mb-7">
                    {["Compras créditos y vienes cuando puedas", "Reservas el día que quieras", "Sin compromiso mensual"].map((f) => (
                      <li key={f} className="flex items-start gap-2.5">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mt-0.5 shrink-0 text-siena"><path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        <span className="font-body text-sm leading-snug text-texto-muted">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <span className="inline-flex items-center justify-center w-full gap-2 py-3 rounded-full font-body text-sm font-semibold tracking-wider uppercase bg-siena text-white group-hover:bg-siena-container transition-all">
                    Ver bonos
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="transition-transform group-hover:translate-x-1"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </span>
                </button>
              </div>
            </div>
          )}

          {!cargando && paso === 2 && disciplinaObj && (
            <Paso2Plan
              disc={disciplinaObj}
              planes={planes}
              value={estado.plan}
              onSelect={(id: PlanId) => {
                update({ plan: id, horarios: [] });
                setPaso(3);
              }}
              onBack={() => { setPaso(1); update({ disciplina: null, plan: null, horarios: [] }); }}
            />
          )}

          {!cargando && paso === 3 && disciplinaObj && planObj && (
            <Paso3Horarios
              disc={disciplinaObj}
              planInfo={planObj}
              slots={slots}
              value={estado.horarios}
              onChange={(horarios) => update({ horarios })}
              onContinuar={() => bozze.length > 0 ? handleCrossSellContinuar() : setPaso(4)}
              onBack={() => setPaso(2)}
            />
          )}

          {/* paso 4: cross-sell */}
          {paso === 4 && estado.disciplina && disciplinaObj && planObj && (
            <Paso4CrossSell
              disciplinaId={estado.disciplina}
              disciplinaNombre={disciplinaObj.nombre}
              planNombre={planObj.nombre}
              planPrecio={planObj.precio}
              bozzeExistentes={bozze}
              onContinuar={handleCrossSellContinuar}
              onAgregarOtra={handleCrossSellAgregar}
            />
          )}

          {/* paso 5: datos personales + confirm */}
          {paso === 5 && bozze.length > 0 && (
            <Paso4Pago
              estado={estado}
              bozze={bozze}
              onChange={update}
              onBack={() => setPaso(4)}
              existingContattoId={contattoId}
              onConfirmado={(cId, iId) => { setContattoId(cId); setIscrizioneId(iId); setPaso(6); }}
            />
          )}

          {/* paso 6: gracias */}
          {paso === 6 && iscrizioneId && bozze.length > 0 && (
            <Paso5Gracias
              iscrizioneId={iscrizioneId}
              disciplinaId={bozze[0].disciplinaId}
              nombre={estado.nombre}
            />
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t py-8" style={{ borderColor: "#dcc1b9" }}>
        <div className="px-6 text-center">
          <p
            className="text-xs tracking-widest uppercase mb-3"
            style={{
              color: "#7d2b13",
              fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif",
              letterSpacing: "0.15em",
            }}
          >
            Andrea Carrió Studio — Alfahuir, Valencia
          </p>
          <FooterLegal />
        </div>
      </footer>
    </div>
  );
}
