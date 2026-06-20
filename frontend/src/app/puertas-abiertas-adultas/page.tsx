"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Script from "next/script";

// Meta (Facebook) Pixel — solo en esta landing de Puertas Abiertas Adultas.
const FB_PIXEL_ID = "2024231855152441";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const DISCIPLINA_OPTIONS = [
  { value: "barre", label: "Barre Fit", desc: "Tonificar, esculpir y energía" },
  { value: "pilates", label: "Pilates Mat", desc: "Abdomen, postura y flexibilidad" },
  { value: "ambas", label: "Tengo curiosidad, ¡quiero probar las dos!", desc: "" },
];

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
  const [disciplina, setDisciplina] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const formValido =
    nombre.trim() !== "" &&
    telefono.trim() !== "" &&
    disciplina !== "";

  // ── Evento de optimización de Meta ──
  // Dispara ViewContent una sola vez cuando la persona llega al formulario.
  const formRef = useRef<HTMLDivElement>(null);
  const viewContentFired = useRef(false);
  useEffect(() => {
    const el = formRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !viewContentFired.current) {
          viewContentFired.current = true;
          window.fbq?.("track", "ViewContent", {
            content_name: "Formulario Puertas Abiertas Adultas",
          });
          obs.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const scrollToForm = () =>
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  // ── Lead de botón (FASE temporal de volumen para Meta) ──
  // Dispara un Lead al pulsar cualquiera de los botones de reserva, etiquetado con
  // content_name para distinguirlo del Lead real (envío del formulario) mediante
  // una Conversión personalizada en Meta. Una vez por botón y visita. Sin CAPI.
  // PARA QUITAR cuando haya estabilidad: borrar el track Lead y dejar scrollToForm.
  const botonLeadFired = useRef<Set<string>>(new Set());
  const handleReservaClick = (origen: string) => {
    if (!botonLeadFired.current.has(origen)) {
      botonLeadFired.current.add(origen);
      window.fbq?.("track", "Lead", { content_name: `Click reserva: ${origen}` });
    }
    logFunnel("pa_click");
    scrollToForm();
  };

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

  // ── Embudo interno (anónimo): Visita → Pulsó reservar → Reserva ──
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
      }),
    }).catch(() => {});
  };
  useEffect(() => {
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

  const handleSubmit = async () => {
    if (!formValido || enviando) return;
    setEnviando(true);
    setErrorMsg("");
    try {
      const eventId = (typeof crypto !== "undefined" && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const getCookie = (n: string) =>
        document.cookie.split("; ").find(c => c.startsWith(n + "="))?.split("=")[1] || null;

      const res = await fetch("/api/puertas-abiertas-adultas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          telefono: telefono.trim(),
          email: "",
          disciplina,
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
        }),
      });
      if (!res.ok) throw new Error();
      setEnviado(true);
      logFunnel("pa_reserva");
      // Conversión: ha reservado su clase de prueba. Mismo eventID que CAPI.
      window.fbq?.("track", "Lead", {}, { eventID: eventId });
    } catch {
      setErrorMsg("Ha habido un problema al enviar. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center"
        style={{ backgroundColor: C.bg }}
      >
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-8"
          style={{ backgroundColor: C.blush }}
        >
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <path d="M7 18l8 8L29 10" stroke={C.burgundy} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2
          className="text-4xl sm:text-5xl mb-5"
          style={{ fontFamily: fSerif, color: C.burgundy }}
        >
          ¡Plaza reservada!
        </h2>
        <p className="text-base max-w-md leading-relaxed mb-8" style={{ color: C.brown }}>
          Me alegra muchísimo que vengas a probar. He creado un grupo de WhatsApp donde voy compartiendo todos los detalles de la jornada. Únete para no perderte nada — y así te confirmo tu horario.
        </p>

        <a
          href="https://chat.whatsapp.com/GvefZIztp0G5Wb3gif5f2g"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-3 px-7 py-4 rounded-2xl text-white font-semibold shadow-lg hover:opacity-90 transition-opacity mb-4"
          style={{ backgroundColor: "#25D366", fontFamily: fSans }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.477-1.717zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
          </svg>
          Unirme al grupo de WhatsApp
        </a>

        <p className="text-sm max-w-md leading-relaxed mb-10" style={{ color: C.brown }}>
          ¡Hasta el 24 de julio!<br />
          <strong>Andrea</strong>
        </p>

        <a
          href="https://andreacarriostudio.es"
          className="text-sm uppercase tracking-widest hover:opacity-70 transition-opacity"
          style={{ color: C.muted, fontFamily: fSans }}
        >
          Ir a la web de Andrea Carrió Studio
        </a>
      </div>
    );
  }

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
            Clase de prueba gratuita · 24 de julio · Valencia (Zona Alfahuir)
          </p>

          <h1
            className="text-[1.7rem] sm:text-5xl mb-4 leading-[1.15]"
            style={{ fontFamily: fSerif, color: C.burgundy }}
          >
            Tonifica tu cuerpo, libera tensiones y regálate 60 minutos de desconexión real
          </h1>

          {/* Disciplinas destacadas — visibles al entrar (coherencia anuncio/landing) */}
          <p
            className="text-lg sm:text-2xl font-bold mb-5"
            style={{ color: C.burgundy, fontFamily: fSans }}
          >
            Pilates Mat <span style={{ color: C.muted, fontWeight: 400 }}>·</span> Barre Fit
          </p>

          <div className="text-sm sm:text-base leading-relaxed max-w-lg mx-auto mb-6 space-y-3" style={{ color: C.dark }}>
            <p>Descubre dos de las disciplinas más eficaces para fortalecer el cuerpo, mejorar la movilidad y sentirte mejor en tu día a día.</p>
            <p style={{ fontWeight: 600 }}>El 24 de julio podrás probar una clase real, conocer el estudio y resolver todas tus dudas antes de decidir.</p>
          </div>

          <button
            onClick={() => handleReservaClick("hero")}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl text-sm font-semibold uppercase tracking-widest shadow-lg hover:opacity-90 transition-opacity"
            style={{ backgroundColor: C.burgundy, color: C.cream, fontFamily: fSans, letterSpacing: "0.08em" }}
          >
            Reservar mi clase gratis con Andrea
          </button>

          <p className="text-sm mt-4 font-semibold" style={{ color: C.burgundy }}>
            ⚠ Grupos muy reducidos · Las plazas suelen completarse rápido.
          </p>
        </div>
      </div>

      {/* ── Las 4 cosas que vienes a hacer ── */}
      <div className="px-4 py-12">
        <div
          className="max-w-2xl mx-auto rounded-3xl p-7 sm:p-10 shadow-sm"
          style={{ backgroundColor: "#ffffff", border: `1px solid ${C.border}` }}
        >
          <h2
            className="text-2xl sm:text-3xl mb-7 text-center"
            style={{ fontFamily: fSerif, color: C.burgundy }}
          >
            Las 4 cosas que vienes a hacer en estos 60 minutos
          </h2>

          <ul className="space-y-4">
            {[
              ["Tu momento, solo para ti", "60 minutos para soltar el estrés de la semana, moverte y salir con la cabeza despejada y más energía de la que entraste. Sin móvil, sin prisas."],
              ["Pruebas el Barre Fit", "Es la disciplina que está arrasando y a mí me tiene enamorada. Es perfecta si buscas tonificar piernas y glúteos, esculpir el cuerpo y activar tu energía al ritmo de la música (y no, no hace falta saber bailar en absoluto)."],
              ["Pruebas el Pilates Mat", "El clásico en suelo sobre colchoneta. Te vendrá genial si lo que quieres es definir el abdomen, liberar la rigidez de la espalda después de pasar horas sentada y ganar flexibilidad."],
              ["Me conoces a mí y ves si te pilla cerca", "Estaré yo contigo, con grupos pequeños y trato cercano. Y compruebas si el estudio, en la zona de Alfahuir (al lado del Centro Comercial Arena), te cuadra para venir entre semana."],
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
            onClick={() => handleReservaClick("value")}
            className="w-full mt-8 py-4 rounded-2xl text-sm font-semibold uppercase tracking-widest hover:opacity-90 transition-opacity"
            style={{ backgroundColor: C.burgundy, color: C.cream, fontFamily: fSans, letterSpacing: "0.08em" }}
          >
            Quiero reservar mi clase gratis
          </button>

          <div className="mt-6 rounded-2xl p-4" style={{ backgroundColor: "#fff3e0" }}>
            <p className="text-sm leading-relaxed" style={{ color: "#8a4b1a" }}>
              ⚠️ <strong>Un pequeño detalle:</strong> Trabajo siempre con grupos muy reducidos porque me gusta estar pendiente de cada una de vosotras y corregiros bien. Por eso, las plazas para este día son limitadas. Si te apetece venir, reserva tu hueco ahora para no quedarte sin tu horario.
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
            <div className="text-sm leading-relaxed space-y-3" style={{ color: C.brown }}>
              <p>
                Soy <strong style={{ color: C.dark }}>Andrea Carrió</strong>. Tras muchos años dedicada a la danza profesional y a la enseñanza del movimiento, decidí crear este rincón en Valencia.
              </p>
              <p>
                Mi objetivo no es que vengas aquí a sufrir por sufrir. Quiero ayudarte a entrenar de forma inteligente: a ganar fuerza, moldear tu cuerpo, mejorar la postura y, sobre todo, a que salgas de clase con mucha más energía de la que tenías al entrar.
              </p>
              <p>
                Como me obsesiona que hagas los ejercicios bien para cuidar tu espalda y no lesionarte, mis grupos son muy pequeñitos y el trato es súper familiar.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Así será la jornada ── */}
      <div className="px-4 pb-12">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl mb-7 text-center" style={{ fontFamily: fSerif, color: C.burgundy }}>
            Así será la jornada
          </h2>
          <div className="space-y-3">
            {[
              ["Bienvenida", "Os recibiré personalmente, os enseñaré el estudio y os explicaré cómo será la experiencia."],
              ["Clase de prueba (30 min)", "Participarás en una clase real de Pilates Mat o Barre Fit, adaptada a cualquier nivel. Podrás moverte, activar tu cuerpo y descubrir si esta actividad encaja contigo."],
              ["Sorpresa especial + picoteo (30 min)", "Tras la clase nos quedaremos un ratito para compartir, disfrutar de un pequeño aperitivo y descubrir una sorpresa que hemos preparado para las asistentes."],
              ["Decide con tranquilidad", "Sin presiones ni compromiso. Podrás resolver todas tus dudas sobre horarios, niveles y funcionamiento del estudio. Si te gusta la experiencia, te explicaremos las opciones disponibles para empezar en septiembre."],
            ].map(([t, d], i) => (
              <div
                key={t}
                className="flex gap-4 items-start rounded-2xl p-4"
                style={{ backgroundColor: "#ffffff", border: `1px solid ${C.border}` }}
              >
                <span
                  className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ backgroundColor: C.burgundy, color: C.cream, fontFamily: fSans }}
                >
                  {i + 1}
                </span>
                <span>
                  <strong style={{ color: C.dark, fontFamily: fSans, fontSize: "0.95rem" }}>{t}.</strong>{" "}
                  <span className="text-sm" style={{ color: C.brown }}>{d}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Formulario ── */}
      <div ref={formRef} className="px-4 pb-12 scroll-mt-4">
        <div
          className="max-w-xl mx-auto rounded-3xl p-7 sm:p-10 shadow-lg"
          style={{ backgroundColor: "#ffffff", border: `2px solid ${C.burgundy}` }}
        >
          <h2 className="text-2xl sm:text-3xl mb-1 text-center" style={{ fontFamily: fSerif, color: C.burgundy }}>
            Reserva tu plaza en 20 segundos
          </h2>
          <p className="text-sm text-center mb-7" style={{ color: C.brown }}>
            Rellena este mini formulario y te escribiré yo misma por WhatsApp para confirmar tu hora de clase. No te preocupes, odio el spam tanto como tú; no te mandaré publicidad pesada.
          </p>

          <div className="space-y-4">
            <input
              style={inputStyle()}
              placeholder="Nombre"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
            />
            <input
              style={inputStyle()}
              placeholder="WhatsApp"
              type="tel"
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
            />

            <div>
              <p className="text-sm font-semibold mb-2.5" style={{ color: C.brown, fontFamily: fSans }}>
                ¿Qué te apetece probar en tu sesión de 60 minutos?
              </p>
              <div className="flex flex-col gap-2.5">
                {DISCIPLINA_OPTIONS.map(o => {
                  const sel = disciplina === o.value;
                  return (
                    <button
                      key={o.value}
                      onClick={() => setDisciplina(o.value)}
                      className="w-full text-left rounded-2xl px-4 py-3 transition-all"
                      style={{
                        border: `2px solid ${sel ? C.burgundy : C.border}`,
                        backgroundColor: sel ? C.blush : C.cream,
                        outline: "none",
                      }}
                    >
                      <span className="block text-sm font-semibold" style={{ color: sel ? C.burgundy : C.dark, fontFamily: fSans }}>
                        {o.label}
                      </span>
                      {o.desc && (
                        <span className="block text-xs mt-0.5" style={{ color: C.muted }}>{o.desc}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

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
              {enviando ? "Reservando..." : "Quiero reservar mi plaza"}
            </button>
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
              ["¿De verdad es gratis? ¿Dónde está el truco?", "Es 100% gratis. Vienes, pruebas la sesión de 60 minutos, ves el estudio y te vas a casa con un buen entrenamiento encima. El único «truco» es que confío tanto en mis clases que sé que a muchas os encantará el ambiente y os apetecerá quedaros, pero la decisión es completamente tuya."],
              ["¿Y si nunca he hecho Pilates o Barre?", "Mejor todavía. La jornada está pensada justo para eso, para tener una primera toma de contacto muy suave. Yo te iré guiando paso a paso en cada movimiento, así que no te vas a sentir perdida en ningún momento."],
              ["¿Qué es el Barre Fit exactamente?", "Es súper divertido. Mezcla la precisión del Pilates, la elegancia del ballet y el entrenamiento fitness usando la barra de danza como apoyo. Es muy dinámico, con música, y va de lujo para tonificar rápido el tren inferior y el abdomen sin machacar las articulaciones."],
              ["¿Las clases de Pilates son con máquinas?", "No, es Pilates Mat (en suelo con colchoneta). Usamos el propio peso del cuerpo y accesorios como aros, bandas elásticas o pelotas. Es lo más efectivo para corregir la postura y fortalecer el core de verdad."],
              ["¿Qué tengo que llevar?", "Solo ropa cómoda con la que te muevas bien y ganas de probar algo nuevo. Todo el material que necesitas lo tengo yo listo en el estudio."],
              ["¿Me vais a obligar a apuntarme al terminar?", "Para nada. Odio las tácticas de venta pesadas. Vienes, pruebas, y si te encanta, me pides los horarios y los precios. Si ves que no es para ti, tan amigas. Así de simple."],
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
            Venga, elige tu hora antes de que se llenen los grupos
          </h2>
          <p className="text-sm sm:text-base mb-7 max-w-md mx-auto" style={{ color: C.blush }}>
            Si estás leyendo esto, aún quedan huecos libres para el 24 de julio. No lo dejes para el final, ¡tengo muchas ganas de conocerte!
          </p>
          <button
            onClick={() => handleReservaClick("cta_final")}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl text-sm font-semibold uppercase tracking-widest shadow-lg hover:opacity-90 transition-opacity"
            style={{ backgroundColor: C.cream, color: C.burgundy, fontFamily: fSans, letterSpacing: "0.08em" }}
          >
            Reservar mi clase gratis
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
