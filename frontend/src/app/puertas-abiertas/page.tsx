"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Script from "next/script";

// Meta (Facebook) Pixel — solo en esta landing de Puertas Abiertas.
const FB_PIXEL_ID = "2024231855152441";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

const EDAD_NINA_OPTIONS = [
  "Pre-Ballet · 3–6 años",
  "Ballet 1 · 7–9 años",
  "Ballet 2 · 10–12 años",
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

// Check ✓ reutilizable para las listas de beneficios.
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

export default function PuertasAbiertas() {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [edad, setEdad] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const formValido =
    nombre.trim() !== "" &&
    telefono.trim() !== "" &&
    edad !== "";

  // ── Evento de optimización de Meta ──
  // Dispara ViewContent (evento estándar) UNA sola vez cuando la persona llega
  // al formulario: "visita cualificada", el paso justo antes del Lead.
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
            content_name: "Formulario Puertas Abiertas",
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

  // ── Atribución de origen ──
  const atrib = useRef<{
    origen: string;
    utm_source: string | null;
    utm_campaign: string | null;
    fbclid: string | null;
  }>({ origen: "directo", utm_source: null, utm_campaign: null, fbclid: null });
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const utm_source = p.get("utm_source");
    const utm_medium = p.get("utm_medium");
    const utm_campaign = p.get("utm_campaign");
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
    atrib.current = { origen, utm_source, utm_campaign, fbclid };
  }, []);

  const handleSubmit = async () => {
    if (!formValido || enviando) return;
    setEnviando(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/puertas-abiertas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: nombre.trim(),
          apellido: "",
          email: "",
          telefono: telefono.trim(),
          disciplina_adulta: null,
          // El admin cuenta la niña por este array; la edad sirve para asignar horario.
          ninas: [{ nombre: "", edad }],
          alergias: null,
          origen: atrib.current.origen,
          utm_source: atrib.current.utm_source,
          utm_campaign: atrib.current.utm_campaign,
          fbclid: atrib.current.fbclid,
        }),
      });
      if (!res.ok) throw new Error();
      setEnviado(true);
      // Conversión: la madre ha reservado su plaza con éxito.
      window.fbq?.("track", "Lead");
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
          Me alegra muchísimo que tu hija venga a probar. He creado un grupo de WhatsApp donde voy compartiendo todos los detalles de la jornada. Únete para no perderte nada — y así te confirmo tu horario.
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
        className="relative overflow-hidden px-6 pt-14 pb-10 sm:pt-20 text-center"
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
            className="mx-auto mb-5 w-36 sm:w-44 h-auto"
            style={{ objectFit: "contain" }}
          />

          <p
            className="text-xs uppercase tracking-[0.22em] mb-4"
            style={{ color: C.burgundy, fontFamily: fSans, fontWeight: 600 }}
          >
            Jornada de Puertas Abiertas · 24 de julio · Valencia
          </p>

          <h1
            className="text-3xl sm:text-5xl mb-5 leading-tight"
            style={{ fontFamily: fSerif, color: C.burgundy }}
          >
            Descubre si el ballet es para tu hija, sin pagar nada y sin compromiso
          </h1>

          <p
            className="text-base sm:text-lg leading-relaxed max-w-lg mx-auto mb-6"
            style={{ color: C.dark }}
          >
            Una mañana diferente para que tu hija pruebe una clase de ballet de verdad, se divierta, haga nuevas amigas y tú conozcas personalmente a la profesora y el estudio antes de decidir.
          </p>

          <ul className="inline-flex flex-col gap-2 text-left mb-8 mx-auto">
            {[
              "Clase de ballet gratuita",
              "Juegos adaptados a su edad",
              "Merienda incluida",
              "Sin compromiso de inscripción",
            ].map(t => (
              <li key={t} className="flex items-center gap-2.5">
                <Check />
                <span className="text-sm font-medium" style={{ color: C.dark, fontFamily: fSans }}>{t}</span>
              </li>
            ))}
          </ul>

          <button
            onClick={scrollToForm}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl text-sm font-semibold uppercase tracking-widest shadow-lg hover:opacity-90 transition-opacity"
            style={{ backgroundColor: C.burgundy, color: C.cream, fontFamily: fSans, letterSpacing: "0.1em" }}
          >
            Reserva ahora la plaza de tu hija
          </button>

          <p className="text-sm mt-4 font-semibold" style={{ color: C.burgundy }}>
            ⚠ Solo 10 plazas por grupo · Las plazas suelen completarse rápido.
          </p>
        </div>
      </div>

      {/* ── Qué vivirá tu hija (value stack) ── */}
      <div className="px-4 py-12">
        <div
          className="max-w-2xl mx-auto rounded-3xl p-7 sm:p-10 shadow-sm"
          style={{ backgroundColor: "#ffffff", border: `1px solid ${C.border}` }}
        >
          <h2
            className="text-2xl sm:text-3xl mb-2 text-center"
            style={{ fontFamily: fSerif, color: C.burgundy }}
          >
            ¿Qué vivirá tu hija durante la jornada?
          </h2>
          <p className="text-sm text-center mb-7" style={{ color: C.muted }}>
            Todo completamente gratis.
          </p>

          <ul className="space-y-4">
            {[
              ["Una clase de ballet de verdad", "No es una demostración ni una exhibición. Tu hija participará en una clase real, adaptada a su edad, para que descubra si disfruta del ballet desde el primer momento."],
              ["Juegos y actividades divertidas", "Dinámicas pensadas para que las niñas se sientan cómodas, ganen confianza y disfruten mientras aprenden."],
              ["Merienda con sus nuevas compañeras", "Un momento especial para compartir, hacer amigas y sentirse parte del grupo."],
              ["Tú también podrás conocerlo todo", "Conocerás el estudio, resolverás tus dudas y podrás valorar tranquilamente si este es el lugar adecuado para tu hija."],
              ["Matrícula con descuento", "Si decides apuntarla ese mismo día, la matrícula será de 35 € en lugar de 50 €."],
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
            style={{ backgroundColor: C.burgundy, color: C.cream, fontFamily: fSans, letterSpacing: "0.1em" }}
          >
            Quiero reservar la plaza de mi hija
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
            alt="Andrea Carrió, profesora de ballet"
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
              Y quiero que te sientas tranquila desde el primer día.
            </p>
            <div className="text-sm leading-relaxed space-y-3 mb-6" style={{ color: C.brown }}>
              <p>
                Durante los últimos <strong style={{ color: C.dark }}>2 años he sido la profesora de ballet de esta escuela</strong>, la que muchas familias conocéis como la escuela de Mari Cruz Alcalá, en la Calle Motilla del Palancar 34.
              </p>
              <p>
                Ahora comienzo una nueva etapa al frente del estudio, manteniendo el mismo cariño por las alumnas y la misma pasión por la enseñanza.
              </p>
              <p>
                Bailo desde los 3 años y llevo más de 8 años enseñando ballet a niñas de diferentes edades.
              </p>
              <p>
                Mi objetivo no es solo enseñar pasos de danza. Quiero que cada alumna gane confianza, coordinación, disciplina y disfrute aprendiendo en un entorno cercano y familiar.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {["Más de 8 años enseñando ballet", "Bailando desde los 3 años", "2 años en esta misma escuela"].map(s => (
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

      {/* ── Así será la jornada ── */}
      <div className="px-4 pb-12">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl mb-7 text-center" style={{ fontFamily: fSerif, color: C.burgundy }}>
            Así será la jornada
          </h2>
          <div className="space-y-3">
            {[
              ["Bienvenida", "Os recibiré personalmente y os enseñaré el estudio."],
              ["Clase de ballet", "Tu hija participará en una clase adaptada a su edad, con ejercicios, música y juegos."],
              ["Merienda y tiempo para conocernos", "Mientras las niñas meriendan, podré resolver todas tus dudas sobre las clases y la metodología."],
              ["Decide con tranquilidad", "Sin presiones. Si os gusta la experiencia, te explicaré los horarios disponibles y podrás aprovechar la matrícula reducida."],
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
            Reserva la plaza de tu hija
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
              placeholder="Nombre de la madre o padre"
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
                Edad de tu hija
              </p>
              <div className="flex flex-wrap gap-2">
                {EDAD_NINA_OPTIONS.map(o => (
                  <button key={o} onClick={() => setEdad(o)} style={chip(edad === o)}>
                    {o}
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
              {enviando ? "Reservando..." : "Reservar plaza"}
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
              ["¿Cuánto cuesta asistir?", "Nada. La jornada es completamente gratuita."],
              ["¿Y si mi hija nunca ha hecho ballet?", "Perfecto. Muchas niñas asistirán por primera vez. No necesita experiencia previa."],
              ["¿Y si es tímida?", "Las actividades están pensadas para que se sienta cómoda y participe poco a poco, sin presión."],
              ["¿Estoy obligada a apuntarla después?", "No. Puedes venir, conocer la escuela y decidir tranquilamente."],
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
            Solo 10 plazas por grupo para que cada niña reciba atención personalizada. Reserva antes de que se complete su grupo.
          </p>
          <button
            onClick={scrollToForm}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl text-sm font-semibold uppercase tracking-widest shadow-lg hover:opacity-90 transition-opacity"
            style={{ backgroundColor: C.cream, color: C.burgundy, fontFamily: fSans, letterSpacing: "0.1em" }}
          >
            Reservar la plaza de mi hija
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
