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
  { value: "pilates", label: "Pilates Mat" },
  { value: "barre", label: "Barre Fit" },
  { value: "ambas", label: "Las dos" },
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

function chip(selected: boolean) {
  return {
    padding: "10px 20px",
    borderRadius: "999px",
    border: `2px solid ${selected ? C.burgundy : C.border}`,
    backgroundColor: selected ? C.blush : C.cream,
    color: selected ? C.burgundy : C.brown,
    cursor: "pointer",
    fontSize: "0.875rem",
    fontFamily: fSans,
    transition: "all 0.18s ease",
    outline: "none",
    whiteSpace: "nowrap" as const,
  };
}

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
          Me alegra muchísimo que vengas a probar. Te escribiré personalmente por WhatsApp para confirmarte el horario y resolver cualquier duda. ¡Nos vemos pronto!
        </p>

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
            className="text-xs uppercase tracking-[0.22em] mb-3"
            style={{ color: C.burgundy, fontFamily: fSans, fontWeight: 600 }}
          >
            Jornada de Puertas Abiertas · 24 de julio · Valencia
          </p>

          <h1
            className="text-[1.7rem] sm:text-5xl mb-4 leading-[1.15]"
            style={{ fontFamily: fSerif, color: C.burgundy }}
          >
            Descubre el Pilates y el Barre Fit, sin pagar nada y sin compromiso
          </h1>

          <p
            className="text-sm sm:text-lg leading-relaxed max-w-lg mx-auto mb-5"
            style={{ color: C.dark }}
          >
            Una clase de prueba real para que sientas el método, te muevas, cuides tu cuerpo y conozcas el estudio y a tu profesora antes de decidir. Tu momento para ti.
          </p>

          <ul className="inline-flex flex-col gap-1.5 text-left mb-6 mx-auto">
            {[
              "Clase de prueba gratuita",
              "Grupos reducidos",
              "Para cualquier nivel",
              "Sin compromiso de inscripción",
            ].map(t => (
              <li key={t} className="flex items-center gap-2.5">
                <Check />
                <span className="text-sm font-medium" style={{ color: C.dark, fontFamily: fSans }}>{t}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={() => handleReservaClick("hero")}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl text-sm font-semibold uppercase tracking-widest shadow-lg hover:opacity-90 transition-opacity"
            style={{ backgroundColor: C.burgundy, color: C.cream, fontFamily: fSans, letterSpacing: "0.1em" }}
          >
            Reserva tu clase de prueba gratis
          </button>

          <p className="text-sm mt-4 font-semibold" style={{ color: C.burgundy }}>
            ⚠ Plazas limitadas · Los grupos suelen completarse rápido.
          </p>
        </div>
      </div>

      {/* ── Qué vivirás (value stack) ── */}
      <div className="px-4 py-12">
        <div
          className="max-w-2xl mx-auto rounded-3xl p-7 sm:p-10 shadow-sm"
          style={{ backgroundColor: "#ffffff", border: `1px solid ${C.border}` }}
        >
          <h2
            className="text-2xl sm:text-3xl mb-2 text-center"
            style={{ fontFamily: fSerif, color: C.burgundy }}
          >
            ¿Qué vivirás durante la jornada?
          </h2>
          <p className="text-sm text-center mb-7" style={{ color: C.muted }}>
            Todo completamente gratis.
          </p>

          <ul className="space-y-4">
            {[
              ["Una clase real, no una demostración", "Participarás en una clase de verdad de Pilates Mat o Barre Fit, adaptada a tu nivel, para que sientas de primera mano cómo trabajamos."],
              ["Grupos reducidos y atención personalizada", "Pocas personas por clase para que la profesora pueda corregirte, acompañarte y que te lleves la técnica bien hecha."],
              ["Para cualquier nivel y edad", "No necesitas experiencia previa ni una forma física concreta. Empezamos donde tú estás."],
              ["Conoce el estudio con calma", "Verás el espacio, resolverás tus dudas y decidirás tranquilamente si es tu sitio. Sin presiones."],
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
            style={{ backgroundColor: C.burgundy, color: C.cream, fontFamily: fSans, letterSpacing: "0.1em" }}
          >
            Quiero reservar mi clase de prueba
          </button>
        </div>
      </div>

      {/* ── Confianza: Hola, soy Andrea ── */}
      <div className="px-4 pb-12">
        <div
          className="max-w-4xl mx-auto rounded-3xl overflow-hidden grid md:grid-cols-2"
          style={{ backgroundColor: "#ffffff", border: `1px solid ${C.border}` }}
        >
          <Image
            src="/andrea.jpg"
            alt="Andrea Carrió"
            width={1792}
            height={2400}
            sizes="(max-width: 768px) 100vw, 400px"
            className="w-full h-full object-cover block"
          />
          <div className="p-7 sm:p-9">
            <h2 className="text-2xl sm:text-3xl mb-2" style={{ fontFamily: fSerif, color: C.burgundy }}>
              Hola, soy Andrea Carrió
            </h2>
            <p className="text-sm font-medium mb-4" style={{ color: C.dark, fontFamily: fSans }}>
              Y quiero que tengas un espacio donde cuidarte, a tu ritmo.
            </p>
            <div className="text-sm leading-relaxed space-y-3 mb-6" style={{ color: C.brown }}>
              <p>
                Acabo de abrir mi propio estudio en la <strong style={{ color: C.dark }}>Calle Motilla del Palancar 34</strong>, en la zona de Alfahuir, la que muchas conocéis como la escuela de Mari Cruz Alcalá.
              </p>
              <p>
                Además de las clases de ballet, he creado un espacio para adultas con <strong style={{ color: C.dark }}>Pilates Mat y Barre Fit</strong>: clases para moverte, mejorar tu postura, ganar fuerza y dedicarte un rato solo para ti.
              </p>
              <p>
                Llevo toda mi vida ligada a la danza y al movimiento, y mi forma de trabajar es siempre cercana: grupos pequeños, trato personal y mucho cuidado por la técnica.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {["Grupos reducidos", "Trato cercano y personal", "Estudio propio en Alfahuir"].map(s => (
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

      {/* ── Formulario ── */}
      <div ref={formRef} className="px-4 pb-12 scroll-mt-4">
        <div
          className="max-w-xl mx-auto rounded-3xl p-7 sm:p-10 shadow-lg"
          style={{ backgroundColor: "#ffffff", border: `2px solid ${C.burgundy}` }}
        >
          <h2 className="text-2xl sm:text-3xl mb-1 text-center" style={{ fontFamily: fSerif, color: C.burgundy }}>
            Reserva tu clase de prueba
          </h2>
          <p className="text-sm text-center mb-1" style={{ color: C.brown }}>
            Solo necesitas 20 segundos.
          </p>
          <p className="text-sm text-center mb-7 font-semibold" style={{ color: C.burgundy }}>
            Las plazas son limitadas para garantizar una atención personalizada.
          </p>

          <div className="space-y-4">
            <input
              style={inputStyle()}
              placeholder="Tu nombre"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
            />
            <input
              style={inputStyle()}
              placeholder="Teléfono (WhatsApp)"
              type="tel"
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
            />

            <div>
              <p className="text-sm font-semibold mb-2" style={{ color: C.brown, fontFamily: fSans }}>
                ¿Qué quieres probar?
              </p>
              <div className="flex flex-wrap gap-2">
                {DISCIPLINA_OPTIONS.map(o => (
                  <button key={o.value} onClick={() => setDisciplina(o.value)} style={chip(disciplina === o.value)}>
                    {o.label}
                  </button>
                ))}
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
                letterSpacing: "0.1em",
                cursor: formValido ? "pointer" : "not-allowed",
                opacity: enviando ? 0.7 : 1,
              }}
            >
              {enviando ? "Reservando..." : "Reservar mi plaza"}
            </button>

            <p className="text-xs text-center" style={{ color: C.muted }}>
              Te escribiré personalmente por WhatsApp para confirmar el horario. No recibirás publicidad ni mensajes innecesarios.
            </p>
          </div>
        </div>
      </div>

      {/* ── FAQ ── */}
      <div className="px-4 pb-12">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl mb-6 text-center" style={{ fontFamily: fSerif, color: C.burgundy }}>
            Preguntas frecuentes
          </h2>
          <div className="space-y-3">
            {[
              ["¿Cuánto cuesta asistir?", "Nada. La clase de prueba es completamente gratuita."],
              ["¿Y si nunca he hecho Pilates o Barre?", "Perfecto. Las clases se adaptan a tu nivel y muchas personas vienen por primera vez. No necesitas experiencia."],
              ["¿Qué necesito llevar?", "Ropa cómoda y unos calcetines. El material lo tienes en el estudio."],
              ["¿Estoy obligada a apuntarme después?", "No. Vienes, pruebas, conoces el estudio y decides con calma."],
              ["¿Dónde está el estudio?", "Carrer de Motilla del Palancar 34, zona Alfahuir, Valencia. A solo 5 minutos del Centro Comercial Arena."],
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

      {/* ── Plazas limitadas (CTA final) ── */}
      <div className="px-4 pb-12">
        <div
          className="max-w-2xl mx-auto rounded-3xl p-8 sm:p-10 text-center"
          style={{ backgroundColor: C.burgundy }}
        >
          <h2 className="text-2xl sm:text-3xl mb-3" style={{ fontFamily: fSerif, color: C.cream }}>
            Plazas limitadas
          </h2>
          <p className="text-sm sm:text-base mb-7 max-w-md mx-auto" style={{ color: C.blush }}>
            Grupos reducidos para que cada persona reciba atención personalizada. Reserva antes de que se complete tu clase.
          </p>
          <button
            onClick={() => handleReservaClick("cta_final")}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl text-sm font-semibold uppercase tracking-widest shadow-lg hover:opacity-90 transition-opacity"
            style={{ backgroundColor: C.cream, color: C.burgundy, fontFamily: fSans, letterSpacing: "0.1em" }}
          >
            Reservar mi clase de prueba
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
            En el corazón de Alfahuir
          </h2>
          <p className="text-sm mb-5" style={{ color: C.dark }}>
            Carrer de Motilla del Palancar 34 · Zona Alfahuir, Valencia · A 5 min del C.C. Arena
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
