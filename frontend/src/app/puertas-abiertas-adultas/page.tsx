"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Script from "next/script";

// Meta (Facebook) Pixel — solo en esta landing de adultas.
const FB_PIXEL_ID = "2024231855152441";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const C = {
  burgundy: "#7d2b13",
  blush: "#ffdbd1",
  cream: "#fff8f5",
  bg: "#f5ede8",
  brown: "#56423d",
  dark: "#25190f",
  muted: "#89726c",
  border: "#dcc1b9",
};

const fSerif = "var(--font-playfair), 'Playfair Display', Georgia, serif";
const fSans = "var(--font-montserrat), 'Montserrat', sans-serif";

// Versiones del hero para el A/B por rotación. Cada visita muestra la siguiente
// (cíclico) y se etiqueta impresión + lead con su índice (0,1,2) para el admin.
const VARIANTES = [
  {
    headline: "Este septiembre los peques vuelven al cole. ¿Y si tú también empiezas algo tuyo?",
    body: [
      "Imagina llegar a octubre firme, con la postura recta y la energía de vuelta.",
      "Con Pilates Mat y Barre Fit tonificas de bajo impacto, recuperas suelo pélvico y postura, y despejas la cabeza en cada sesión.",
      "Abrimos en septiembre en la zona de Alfahuir (Valencia), a 5 min del CC Arena. Grupos reducidos por la mañana y por la tarde: haz nuevas amigas y disfruta haciendo ejercicio. Para principiantes y para avanzadas.",
    ],
  },
  {
    headline: "Este septiembre, empieza a cuidarte y tonificarte con Pilates Mat y Barre Fit.",
    body: [
      "No lo dejes para «cuando tenga tiempo»: empieza desde el primer día.",
      "Gana fuerza, postura y ligereza. Clase tras clase.",
      "Abrimos en septiembre en la zona de Alfahuir (Valencia), a 5 min del CC Arena. Grupos reducidos por la mañana y por la tarde: haz nuevas amigas y disfruta haciendo ejercicio. Para principiantes y para avanzadas.",
    ],
  },
  {
    headline: "Un verano de chiringuito, cañas y cero ejercicio. Toca volver a sentirte firme y con energía.",
    body: [
      "Imagina llegar a octubre con los brazos, el abdomen y las piernas firmes otra vez.",
      "Con Pilates Mat y Barre Fit esculpes el músculo con movimientos pequeños y controlados: firmeza real de bajo impacto, sin castigar las articulaciones.",
      "Abrimos en septiembre en la zona de Alfahuir (Valencia), a 5 min del CC Arena. Grupos reducidos por la mañana y por la tarde: haz nuevas amigas y disfruta haciendo ejercicio. Para principiantes y para avanzadas.",
    ],
  },
];

function inputStyle() {
  return {
    border: `1.5px solid ${C.border}`,
    borderRadius: "12px",
    padding: "12px 16px",
    // 16px evita el auto-zoom de iOS Safari al enfocar el campo en móvil.
    fontSize: "16px",
    fontFamily: fSans,
    color: C.dark,
    backgroundColor: C.cream,
    outline: "none",
    width: "100%",
  };
}

function Check() {
  return (
    <span
      className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5"
      style={{ backgroundColor: C.blush }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M5 13l4 4L19 7" stroke={C.burgundy} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export default function PuertasAbiertasAdultas() {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const formRef = useRef<HTMLDivElement>(null);
  const [varIdx, setVarIdx] = useState(0);
  const varIdxRef = useRef(0);

  const formValido =
    nombre.trim() !== "" &&
    telefono.trim() !== "" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  // ── Atribución de origen ──
  const atrib = useRef<{
    origen: string;
    utm_source: string | null;
    utm_medium: string | null;
    utm_campaign: string | null;
    utm_content: string | null;
    utm_term: string | null;
    fbclid: string | null;
  }>({ origen: "directo", utm_source: null, utm_medium: null, utm_campaign: null, utm_content: null, utm_term: null, fbclid: null });
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const utm_source = p.get("utm_source");
    const utm_medium = p.get("utm_medium");
    const utm_campaign = p.get("utm_campaign");
    const utm_content = p.get("utm_content");
    const utm_term = p.get("utm_term");
    const fbclid = p.get("fbclid");
    const origenParam = p.get("origen");
    const src = (utm_source || "").toLowerCase();
    const med = (utm_medium || "").toLowerCase();
    let origen = "directo";
    if (
      fbclid ||
      ["facebook", "fb", "ig", "instagram", "meta"].includes(src) ||
      ["paid", "cpc", "ppc", "paid_social"].includes(med)
    ) {
      origen = "ads";
    } else if (origenParam) {
      origen = origenParam.toLowerCase();
    }
    atrib.current = { origen, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid };
  }, []);

  // ── Embudo interno (anónimo): Visita → Pulsó → Dejó datos ──
  const paSessionRef = useRef<string>("");
  const paLogged = useRef<Set<string>>(new Set());
  const logFunnel = (step: string) => {
    if (!paSessionRef.current || paLogged.current.has(step)) return;
    paLogged.current.add(step);
    fetch("/api/funnel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: paSessionRef.current,
        step,
        origen: atrib.current.origen === "ads" ? "ads" : "directo",
        funnel: "adultas",
        variante: varIdxRef.current,
      }),
    }).catch(() => {});
  };
  useEffect(() => {
    // Rotación del titular: cada visita muestra la siguiente versión (cíclico).
    let idx = 0;
    try {
      const raw = localStorage.getItem("acs_pa_titular_idx");
      idx = raw != null ? (((parseInt(raw, 10) % VARIANTES.length) + VARIANTES.length) % VARIANTES.length) : 0;
      if (Number.isNaN(idx)) idx = 0;
      localStorage.setItem("acs_pa_titular_idx", String((idx + 1) % VARIANTES.length));
    } catch {}
    varIdxRef.current = idx;
    setVarIdx(idx);

    let sid = sessionStorage.getItem("acs_pa_adultas_fsid");
    if (!sid) {
      sid = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      sessionStorage.setItem("acs_pa_adultas_fsid", sid);
    }
    paSessionRef.current = sid;
    logFunnel("pa_visita");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Los botones llevan al formulario (no directo al pago).
  const scrollToForm = () => {
    logFunnel("pa_click");
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Guarda el contacto (lead en BD + Lead a Meta) y va al checkout "/" con los
  // datos prerrellenados (sessionStorage compartido, mismo origen), con las UTM.
  const handleSubmit = async () => {
    if (!formValido || enviando) return;
    setEnviando(true);
    setErrorMsg("");
    const eventId = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    // Referencia del lead: enlaza a esta persona con su recorrido en el checkout.
    const leadRef = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const getCookie = (n: string) =>
      document.cookie.split("; ").find(c => c.startsWith(n + "="))?.split("=")[1] || null;
    try {
      // keepalive: la petición se completa aunque naveguemos fuera.
      fetch("/api/puertas-abiertas-adultas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          email: email.trim(),
          origen: atrib.current.origen,
          utm_source: atrib.current.utm_source,
          utm_medium: atrib.current.utm_medium,
          utm_campaign: atrib.current.utm_campaign,
          utm_content: atrib.current.utm_content,
          utm_term: atrib.current.utm_term,
          fbclid: atrib.current.fbclid,
          eventId,
          fbc: getCookie("_fbc"),
          fbp: getCookie("_fbp"),
          variante: varIdxRef.current,
          ref: leadRef,
        }),
      }).catch(() => {});
      // Lead del navegador, deduplicado con el del servidor por eventID.
      window.fbq?.("track", "Lead", {}, { eventID: eventId });
      // Datos para prerrellenar el checkout.
      sessionStorage.setItem("acs_prefill", JSON.stringify({
        nombre: nombre.trim(),
        email: email.trim(),
        telefono: telefono.trim(),
        lead_ref: leadRef,
      }));
      logFunnel("pa_reserva");
      window.location.href = "/" + window.location.search;
    } catch {
      setErrorMsg("Ha habido un problema. Inténtalo de nuevo.");
      setEnviando(false);
    }
  };

  return (
    <div style={{ backgroundColor: C.bg, minHeight: "100vh" }}>

      {/* ── Meta Pixel (base) — dispara PageView al cargar la página ── */}
      <Script id="fb-pixel" strategy="afterInteractive">
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
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${FB_PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>

      {/* ── Hero ── */}
      <div
        className="relative overflow-hidden px-6 pt-5 pb-8 sm:pt-16 sm:pb-10 text-center"
        style={{ background: `linear-gradient(160deg, #fff0eb 0%, ${C.bg} 55%, #f0e0d8 100%)` }}
      >
        <div
          className="absolute top-0 right-0 w-72 h-72 rounded-full opacity-20 pointer-events-none"
          style={{ backgroundColor: C.blush, transform: "translate(40%, -40%)" }}
        />
        <div
          className="absolute bottom-0 left-0 w-48 h-48 rounded-full opacity-15 pointer-events-none"
          style={{ backgroundColor: C.blush, transform: "translate(-40%, 40%)" }}
        />

        <div className="relative max-w-xl mx-auto">
          <Image
            src="/logo-email.png"
            alt="Andrea Carrió Studio"
            width={240}
            height={240}
            priority
            className="mx-auto mb-3 w-28 sm:w-44 h-auto"
            style={{ objectFit: "contain" }}
          />

          <p
            className="text-xs uppercase tracking-[0.18em] mb-3"
            style={{ color: C.burgundy, fontFamily: fSans, fontWeight: 600 }}
          >
            Nueva apertura · Estudio de Pilates Mat y Barre Fit · Valencia, Zona Alfahuir
          </p>

          <h1
            className="text-[1.7rem] sm:text-5xl mb-4 leading-[1.15]"
            style={{ fontFamily: fSerif, color: C.burgundy }}
          >
            {VARIANTES[varIdx].headline}
          </h1>

          {/* Disciplinas destacadas — visibles al entrar (coherencia anuncio/landing) */}
          <p
            className="text-lg sm:text-2xl font-bold mb-5"
            style={{ color: C.burgundy, fontFamily: fSans }}
          >
            Pilates Mat <span style={{ color: C.muted, fontWeight: 400 }}>·</span> Barre Fit
          </p>

          <div className="text-sm sm:text-base leading-relaxed max-w-lg mx-auto mb-6 space-y-3" style={{ color: C.dark }}>
            {VARIANTES[varIdx].body.map((t, i) => (
              <p key={i} style={i === 1 ? { fontWeight: 600 } : undefined}>{t}</p>
            ))}
          </div>

          <button
            onClick={scrollToForm}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl text-sm font-semibold uppercase tracking-widest shadow-lg hover:opacity-90 transition-opacity"
            style={{ backgroundColor: C.burgundy, color: C.cream, fontFamily: fSans, letterSpacing: "0.08em" }}
          >
            Reservar mi plaza de septiembre
          </button>

          <p className="text-sm mt-4 font-semibold" style={{ color: C.burgundy }}>
            ⚠ Solo 12 plazas por clase · Los grupos de septiembre se llenan rápido.
          </p>
        </div>
      </div>

      {/* ── Lo que te llevas al empezar ── */}
      <div className="px-4 py-12">
        <div
          className="max-w-2xl mx-auto rounded-3xl p-7 sm:p-10 shadow-sm"
          style={{ backgroundColor: "#ffffff", border: `1px solid ${C.border}` }}
        >
          <h2
            className="text-2xl sm:text-3xl mb-7 text-center"
            style={{ fontFamily: fSerif, color: C.burgundy }}
          >
            ¿Qué te llevas al empezar?
          </h2>

          <ul className="space-y-4">
            {[
              ["Clases reales de Pilates Mat o Barre Fit", "Clases adaptadas a cualquier nivel para que trabajes de verdad tu cuerpo y descubras cómo entrenamos en el estudio."],
              ["La disciplina que mejor encaja contigo", "Los beneficios del Pilates Mat para la postura, la movilidad y el core, y del Barre Fit para la tonificación, el equilibrio y la resistencia muscular."],
              ["Un ambiente cercano y grupos reducidos", "Entrenas con tranquilidad, con atención personalizada y la diferencia de trabajar en grupos pequeños."],
              ["Alguien que te mira y te cuida", "Estoy pendiente de cada movimiento para corregirte bien y que avances segura, sin lesionarte."],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <Check />
                <span>
                  <strong style={{ color: C.dark, fontFamily: fSans, fontSize: "0.95rem" }}>{t}.</strong>{" "}
                  <span className="text-sm" style={{ color: C.brown }}>{d}</span>
                </span>
              </li>
            ))}
          </ul>

          <button
            onClick={scrollToForm}
            className="w-full mt-8 py-4 rounded-2xl text-sm font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity"
            style={{ backgroundColor: C.burgundy, color: C.cream, fontFamily: fSans, letterSpacing: "0.08em" }}
          >
            Quiero reservar mi plaza
          </button>

          <div className="mt-6 rounded-2xl p-4" style={{ backgroundColor: "#fff3e0" }}>
            <p className="text-sm leading-relaxed" style={{ color: "#8a4b1a" }}>
              ⚠️ <strong>Un pequeño detalle:</strong> Trabajo siempre con grupos muy reducidos porque me gusta estar pendiente de cada una de vosotras y corregiros bien. Por eso las plazas son limitadas. Si te apetece empezar, reserva tu hueco ahora para asegurar tu horario.
            </p>
          </div>
        </div>
      </div>

      {/* ── Social proof: fotos reales de las clases ── */}
      <div className="px-4 pb-12">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl mb-2" style={{ fontFamily: fSerif, color: C.burgundy }}>
            Así son nuestras clases
          </h2>
          <p className="text-sm mb-6" style={{ color: C.brown }}>
            Grupos reducidos, ambiente cercano y gente de todas las edades. Únete a las que ya se cuidan aquí.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              "https://andreacarriostudio.es/wp-content/uploads/2026/08/DSC5073.jpg",
              "https://andreacarriostudio.es/wp-content/uploads/2026/08/DSC5201.jpg",
              "https://andreacarriostudio.es/wp-content/uploads/2026/08/DSC5227.jpg",
            ].map((src) => (
              <div key={src} className="rounded-2xl overflow-hidden shadow-sm" style={{ border: `1px solid ${C.border}` }}>
                <Image
                  src={src}
                  alt="Clase de Pilates Mat y Barre Fit en Andrea Carrió Studio (Valencia)"
                  width={1024}
                  height={683}
                  sizes="(max-width: 640px) 100vw, 300px"
                  className="w-full h-full object-cover block"
                  style={{ aspectRatio: "3 / 2" }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Formulario: datos para continuar al pago ── */}
      <div ref={formRef} className="px-4 pb-12 scroll-mt-4">
        <div
          className="max-w-xl mx-auto rounded-3xl p-7 sm:p-10 shadow-lg"
          style={{ backgroundColor: "#ffffff", border: `2px solid ${C.burgundy}` }}
        >
          <h2 className="text-2xl sm:text-3xl mb-1 text-center" style={{ fontFamily: fSerif, color: C.burgundy }}>
            Reserva tu plaza en 30 segundos
          </h2>
          <p className="text-sm text-center mb-7" style={{ color: C.brown }}>
            Déjame tus datos y sigues al pago con todo ya rellenado. Odio el spam tanto como tú; te escribo yo misma por WhatsApp solo para lo importante.
          </p>

          <div className="space-y-4">
            <input style={inputStyle()} placeholder="Nombre y apellido" value={nombre} onChange={e => setNombre(e.target.value)} />
            <input style={inputStyle()} placeholder="WhatsApp" type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} />
            <input style={inputStyle()} placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />

            {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

            <button
              onClick={handleSubmit}
              disabled={!formValido || enviando}
              className="w-full py-4 rounded-2xl text-sm font-semibold uppercase tracking-widest transition-all"
              style={{
                backgroundColor: formValido ? C.burgundy : C.border,
                color: "#fff8f5",
                fontFamily: fSans,
                letterSpacing: "0.08em",
                cursor: formValido ? "pointer" : "not-allowed",
                opacity: enviando ? 0.7 : 1,
              }}
            >
              {enviando ? "Un momento..." : "Continuar a la reserva"}
            </button>
            <p className="text-xs text-center" style={{ color: C.muted }}>
              Al continuar, eliges disciplina, horario y completas tu reserva.
            </p>
          </div>
        </div>
      </div>

      {/* ── Confianza: un poco sobre mí ── */}
      <div className="px-4 pb-12">
        <div
          className="max-w-4xl mx-auto rounded-3xl overflow-hidden grid md:grid-cols-2"
          style={{ backgroundColor: "#ffffff", border: `1px solid ${C.border}` }}
        >
          <Image
            src="/andrea-adultas.jpg"
            alt="Andrea Carrió"
            width={1200}
            height={1607}
            sizes="(max-width: 768px) 100vw, 400px"
            className="w-full h-full object-cover block"
          />
          <div className="p-7 sm:p-9">
            <h2 className="text-2xl sm:text-3xl mb-2" style={{ fontFamily: fSerif, color: C.burgundy }}>
              Un poco sobre mí…
            </h2>
            <p className="text-sm font-medium mb-4" style={{ color: C.dark, fontFamily: fSans }}>
              …por si aún no nos conocemos.
            </p>
            <div className="text-sm leading-relaxed space-y-3 mb-6" style={{ color: C.brown }}>
              <p>
                <strong style={{ color: C.dark }}>Soy Andrea Carrió</strong>, titulada oficial en danza clásica y con certificación en Pilates Mat y Barre Fit.
              </p>
              <p>
                Muchos ya me conocéis como la profesora de ballet de la escuela que durante años fue la de Maricuz Alcalá. Ahora tomo el mando de este espacio con un proyecto más amplio: seguir cuidando a las niñas que llevan años aquí y, al mismo tiempo, abrir las puertas a las adultas.
              </p>
              <p>
                Porque mi sueño más grande es que este estudio sea algo más que un lugar donde hacer ejercicio. Quiero que sea vuestra segunda casa: un sitio donde desconectar de verdad, sentiros bien con vuestro cuerpo y saber que alguien os está mirando y cuidando en cada movimiento.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {["Titulada oficial en danza clásica", "Certificada en Pilates Mat y Barre Fit", "+8 años enseñando"].map(s => (
                <span
                  key={s}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: C.cream, border: `1px solid ${C.border}`, color: C.burgundy, fontFamily: fSans }}
                >
                  {s}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── FAQ ── */}
      <div className="px-4 pb-12">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl mb-2 text-center" style={{ fontFamily: fSerif, color: C.burgundy }}>
            Preguntas frecuentes
          </h2>
          <p className="text-sm text-center mb-6" style={{ color: C.muted }}>
            Respondidas por mí.
          </p>
          <div className="space-y-3">
            {[
              ["¿Y si nunca he hecho Pilates o Barre?", "Mejor todavía. Las clases están pensadas para todos los niveles y yo te iré guiando paso a paso en cada movimiento, así que no te vas a sentir perdida en ningún momento."],
              ["¿Qué es el Barre Fit exactamente?", "Es súper divertido. Mezcla la precisión del Pilates, la elegancia del ballet y el entrenamiento fitness usando la barra de danza como apoyo. Es muy dinámico, con música, y va de lujo para tonificar rápido el tren inferior y el abdomen sin machacar las articulaciones."],
              ["¿Las clases de Pilates son con máquinas?", "No, es Pilates Mat (en suelo con colchoneta). Usamos el propio peso del cuerpo y accesorios como aros, bandas elásticas o pelotas. Es lo más efectivo para corregir la postura y fortalecer el core de verdad."],
              ["¿Qué tengo que llevar?", "Solo ropa cómoda con la que te muevas bien. Todo el material que necesitas lo tengo yo listo en el estudio."],
              ["¿Cómo reservo mi plaza?", "Muy fácil: déjame tus datos en el formulario de arriba y sigues al pago con todo rellenado. Eliges disciplina y horario y completas tu reserva en unos minutos. Cualquier duda, me tienes a mí al otro lado."],
              ["¿Dónde estás exactamente?", "En Carrer de Motilla del Palancar 34, en la zona de Alfahuir (Valencia). Estamos a solo 5 minutos andando del Centro Comercial Arena. Si vives por el barrio o cerquita, te pillará perfecto para venir a entrenar a un paso de casa."],
            ].map(([q, a]) => (
              <details
                key={q}
                className="rounded-2xl p-4 sm:px-5"
                style={{ backgroundColor: "#ffffff", border: `1px solid ${C.border}` }}
              >
                <summary
                  className="cursor-pointer text-sm font-semibold flex justify-between items-center gap-2"
                  style={{ color: C.burgundy, fontFamily: fSans, listStyle: "none" }}
                >
                  {q}
                  <span style={{ color: C.muted, fontSize: "0.75rem" }}>▼</span>
                </summary>
                <p className="text-sm mt-3 leading-relaxed" style={{ color: C.brown }}>{a}</p>
              </details>
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA final ── */}
      <div className="px-4 pb-12">
        <div
          className="max-w-2xl mx-auto rounded-3xl p-8 sm:p-10 text-center"
          style={{ backgroundColor: C.burgundy }}
        >
          <h2 className="text-2xl sm:text-3xl mb-3" style={{ fontFamily: fSerif, color: C.cream }}>
            ¿Vuelves en forma este septiembre?
          </h2>
          <p className="text-sm sm:text-base mb-7 max-w-md mx-auto" style={{ color: C.blush }}>
            El curso empieza en septiembre y las plazas se llenan. Reserva la tuya ahora y empieza a cuidarte en un estudio cercano y de confianza.
          </p>
          <button
            onClick={scrollToForm}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl text-sm font-semibold uppercase tracking-widest shadow-lg hover:opacity-90 transition-opacity"
            style={{ backgroundColor: C.cream, color: C.burgundy, fontFamily: fSans, letterSpacing: "0.08em" }}
          >
            Reservar mi plaza
          </button>
        </div>
      </div>

      {/* ── Dónde estamos ── */}
      <div className="px-4 pb-16">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] mb-2" style={{ color: C.muted, fontFamily: fSans }}>
            Dónde estamos
          </p>
          <h2 className="text-2xl sm:text-3xl mb-2" style={{ fontFamily: fSerif, color: C.burgundy }}>
            📍 En el corazón de Alfahuir
          </h2>
          <p className="text-sm mb-5" style={{ color: C.dark }}>
            Carrer de Motilla del Palancar 34 · Alfahuir, Valencia · A 5 minutos del Centro Comercial Arena
          </p>
          <div className="rounded-3xl overflow-hidden shadow-lg" style={{ border: `1px solid ${C.border}` }}>
            <iframe
              title="Ubicación de Andrea Carrió Studio"
              src="https://www.google.com/maps?q=Carrer+de+Motilla+del+Palancar+34,+46019+Val%C3%A8ncia&z=16&output=embed"
              width="100%"
              height="300"
              style={{ border: 0, display: "block", pointerEvents: "none" }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        </div>
      </div>

    </div>
  );
}
