"use client";

import { useState } from "react";
import Image from "next/image";
import Script from "next/script";

// Meta (Facebook) Pixel — solo en esta landing de Puertas Abiertas.
const FB_PIXEL_ID = "2024231855152441";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

type Nina = { nombre: string; edad: string };

const DISCIPLINAS = [
  { value: "ballet-nina", label: "Ballet Niña" },
  { value: "ballet-adultas", label: "Ballet Adultas" },
  { value: "barre", label: "Barre" },
  { value: "pilates-mat", label: "Pilates Mat" },
];

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

function chip(selected: boolean) {
  return {
    padding: "10px 20px",
    borderRadius: "999px",
    border: `2px solid ${selected ? C.burgundy : C.border}`,
    backgroundColor: selected ? C.blush : C.cream,
    color: selected ? C.burgundy : C.brown,
    cursor: "pointer",
    fontSize: "0.875rem",
    fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif",
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
    fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif",
    color: C.dark,
    backgroundColor: C.cream,
    outline: "none",
    width: "100%",
  };
}

export default function PuertasAbiertas() {
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [disciplina, setDisciplina] = useState("");
  const [traeNina, setTraeNina] = useState<boolean | null>(null);
  const [ninas, setNinas] = useState<Nina[]>([{ nombre: "", edad: "" }]);
  const [alergias, setAlergias] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Solo se piden datos de niña si la madre marca "Sí" explícitamente.
  // Dentro de cada niña, basta con la edad: el nombre es opcional.
  const ninasOk = traeNina === true
    ? ninas.every(n => n.edad !== "")
    : true;

  const formValido =
    nombre.trim() !== "" &&
    apellido.trim() !== "" &&
    email.trim() !== "" &&
    telefono.trim() !== "" &&
    disciplina !== "" &&
    ninasOk;

  const addNina = () => setNinas(p => [...p, { nombre: "", edad: "" }]);
  const removeNina = (i: number) => setNinas(p => p.filter((_, idx) => idx !== i));
  const updateNina = (i: number, field: keyof Nina, val: string) =>
    setNinas(p => p.map((n, idx) => idx === i ? { ...n, [field]: val } : n));

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
          apellido: apellido.trim(),
          email: email.trim().toLowerCase(),
          telefono: telefono.trim(),
          disciplina_adulta: disciplina,
          ninas: traeNina ? ninas : [],
          alergias: alergias.trim() || null,
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
          style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", color: C.burgundy }}
        >
          ¡Reserva hecha!
        </h2>
        <p className="text-base max-w-md leading-relaxed mb-8" style={{ color: C.brown }}>
          Me alegra mucho que quieras venir. He creado un grupo de WhatsApp donde iré compartiendo todos los detalles de la Jornada de Puertas Abiertas. Únete para no perderte nada.
        </p>

        <a
          href="https://chat.whatsapp.com/GvefZIztp0G5Wb3gif5f2g"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-3 px-7 py-4 rounded-2xl text-white font-semibold shadow-lg hover:opacity-90 transition-opacity mb-4"
          style={{ backgroundColor: "#25D366", fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif" }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.477-1.717zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
          </svg>
          Unirme al grupo de WhatsApp
        </a>

        <p className="text-sm max-w-md leading-relaxed mb-10" style={{ color: C.brown }}>
          ¡Hasta pronto!<br />
          <strong>Andrea</strong>
        </p>

        <a
          href="https://andreacarriostudio.es"
          className="text-sm uppercase tracking-widest hover:opacity-70 transition-opacity"
          style={{ color: C.muted, fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif" }}
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
        className="relative overflow-hidden px-6 pt-16 pb-8 sm:pt-24 sm:pb-10 text-center"
        style={{
          background: `linear-gradient(160deg, #fff0eb 0%, ${C.bg} 55%, #f0e0d8 100%)`,
        }}
      >
        {/* Decorative circles */}
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
            className="mx-auto mb-6 w-44 sm:w-56 h-auto"
            style={{ objectFit: "contain" }}
          />

          <p
            className="text-xs uppercase tracking-[0.25em] mb-4"
            style={{ color: C.muted, fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif" }}
          >
            Ballet para niñas · Pilates y Barre Fit para adultas · Valencia
          </p>

          <h1
            className="text-4xl sm:text-5xl mb-6 leading-tight"
            style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", color: C.burgundy }}
          >
            Jornada de<br />Puertas Abiertas
          </h1>

          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="h-px flex-1 max-w-[60px]" style={{ backgroundColor: C.border }} />
            <span className="text-lg" style={{ color: C.blush }}>✦</span>
            <div className="h-px flex-1 max-w-[60px]" style={{ backgroundColor: C.border }} />
          </div>

          <p
            className="text-lg sm:text-xl mb-5 leading-snug max-w-md mx-auto"
            style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", color: C.burgundy }}
          >
            Mi escuela de ballet para niñas. Y para ti: Ballet, Pilates y Barre Fit.
          </p>

          <p
            className="text-lg sm:text-xl leading-relaxed max-w-md mx-auto font-medium"
            style={{ color: C.dark }}
          >
            Ven el 24 de julio: te enseño el estudio por dentro y nos conocemos en persona. Tu hija prueba su primera clase de ballet, y si vienes para ti, pruebas la disciplina que más te apetezca.
          </p>

          <p
            className="text-base sm:text-lg leading-relaxed mt-4 font-semibold"
            style={{ color: C.burgundy, fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif" }}
          >
            No hace falta experiencia. Solo ganas.
          </p>
        </div>
      </div>

      {/* ── Dónde estamos ── */}
      <div className="px-4 pt-2 pb-10">
        <div className="max-w-3xl mx-auto text-center">
          <p
            className="text-xs font-semibold uppercase tracking-[0.2em] mb-3"
            style={{ color: C.muted, fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif" }}
          >
            Dónde estamos
          </p>
          <h2
            className="text-3xl sm:text-4xl mb-3"
            style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", color: C.burgundy }}
          >
            En el corazón de Valencia
          </h2>
          <p className="text-base mb-6" style={{ color: C.dark }}>
            Carrer de Motilla del Palancar 34 · Zona Alfahuir · 46019 València
          </p>

          <div
            className="rounded-3xl overflow-hidden shadow-lg"
            style={{ border: `1px solid ${C.border}` }}
          >
            <iframe
              title="Ubicación de Andrea Carrió Studio"
              src="https://www.google.com/maps?q=Carrer+de+Motilla+del+Palancar+34,+46019+Val%C3%A8ncia&z=16&output=embed"
              width="100%"
              height="320"
              style={{ border: 0, display: "block" }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </div>
      </div>

      {/* ── Cuerpo: Andrea + Formulario ── */}
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-20">
        <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-6 lg:gap-10 lg:items-start">

        {/* ── Soy Andrea (fija en desktop) ── */}
        <div className="lg:sticky lg:top-8">
        <div
          className="rounded-3xl overflow-hidden flex flex-col text-center sm:text-left"
          style={{ backgroundColor: "#ffffff", border: `1px solid ${C.border}` }}
        >
          <Image
            src="/andrea.jpg"
            alt="Andrea Carrió"
            width={1792}
            height={2400}
            priority
            sizes="(max-width: 1024px) 100vw, 400px"
            className="w-full h-auto block"
          />
          <div className="p-7 sm:p-8">
            <p
              className="text-xs uppercase tracking-[0.2em] mb-1.5"
              style={{ color: C.muted, fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif" }}
            >
              Soy Andrea
            </p>
            <div className="text-sm leading-relaxed space-y-3" style={{ color: C.brown }}>
              <p>
                Durante años he sido profesora de ballet en diferentes escuelas de Valencia — entre ellas, esta misma, en la Calle Motilla del Palancar 34. La que muchas de vosotras conocéis como la escuela de Maricruz Alcalá.
              </p>
              <p>Hoy tomo el relevo y la hago completamente mía.</p>
              <p>
                La danza me acompaña desde que tengo memoria. Es la forma en la que entiendo el cuerpo, el movimiento y la vida. Y ahora quiero volcar todo eso aquí — en este estudio, en este barrio — para crear un espacio donde bailar y moverse sea algo que se disfruta, se siente y se comparte. Un lugar donde enseñar todo lo que sé, con todo el amor que tengo por este oficio.
              </p>
              <p>
                <strong style={{ color: C.burgundy }}>Esto es Andrea Carrió Studio.</strong> Y me alegra mucho que estés aquí.
              </p>
            </div>
          </div>
        </div>
        </div>{/* /columna Andrea */}

        {/* ── Formulario ── */}
        <div>
        <div
          className="rounded-3xl p-8 sm:p-10 shadow-lg"
          style={{ backgroundColor: "#ffffff", border: `1px solid ${C.border}` }}
        >
          <h2
            className="text-xl mb-1"
            style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", color: C.dark }}
          >
            Reserva tu plaza
          </h2>
          <p className="text-sm mb-2" style={{ color: C.muted }}>
            Es gratuito y sin compromiso. Solo necesito saber que venís.
          </p>
          <p className="text-xs mb-8" style={{ color: C.muted }}>
            Los campos con <span aria-hidden="true" style={{ color: "#c0392b" }}>*</span> son obligatorios.
          </p>

          <div className="space-y-8">

            {/* ── Datos personales ── */}
            <div>
              <SectionLabel text="Tus datos" required />
              <div className="grid grid-cols-2 gap-3 mb-3">
                <input
                  style={inputStyle()}
                  placeholder="Nombre *"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                />
                <input
                  style={inputStyle()}
                  placeholder="Apellido *"
                  value={apellido}
                  onChange={e => setApellido(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  style={inputStyle()}
                  placeholder="Email *"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
                <input
                  style={inputStyle()}
                  placeholder="Teléfono *"
                  type="tel"
                  value={telefono}
                  onChange={e => setTelefono(e.target.value)}
                />
              </div>
            </div>

            {/* ── Disciplina ── */}
            <div>
              <SectionLabel text="¿Qué te apetece probar?" required />
              <div className="flex flex-wrap gap-2">
                {DISCIPLINAS.map(d => (
                  <button
                    key={d.value}
                    onClick={() => setDisciplina(d.value)}
                    style={chip(disciplina === d.value)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Niñas ── */}
            <div>
              <SectionLabel text="¿La reserva es para tu hija?" />
              <div className="flex gap-2 mb-4">
                <button onClick={() => setTraeNina(true)} style={chip(traeNina === true)}>Sí</button>
                <button
                  onClick={() => { setTraeNina(false); setNinas([{ nombre: "", edad: "" }]); }}
                  style={chip(traeNina === false)}
                >
                  No
                </button>
              </div>

              {traeNina === true && (
                <div className="space-y-4">
                  {ninas.map((nina, i) => (
                    <div
                      key={i}
                      className="rounded-2xl p-4 relative"
                      style={{ backgroundColor: C.cream, border: `1px solid ${C.border}` }}
                    >
                      {ninas.length > 1 && (
                        <button
                          onClick={() => removeNina(i)}
                          className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center text-xs hover:opacity-80 transition-opacity"
                          style={{ backgroundColor: C.border, color: C.brown }}
                          aria-label="Eliminar"
                        >
                          ×
                        </button>
                      )}
                      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: C.muted }}>
                        {ninas.length > 1 ? `Niña ${i + 1}` : "Datos de tu hija"}
                      </p>
                      <input
                        style={{ ...inputStyle(), marginBottom: "12px" }}
                        placeholder="Nombre de tu hija (opcional)"
                        value={nina.nombre}
                        onChange={e => updateNina(i, "nombre", e.target.value)}
                      />
                      <p className="text-xs font-semibold mb-2" style={{ color: C.brown }}>
                        Edad <span aria-hidden="true" style={{ color: "#c0392b" }}>*</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {EDAD_NINA_OPTIONS.map(edad => (
                          <button
                            key={edad}
                            onClick={() => updateNina(i, "edad", edad)}
                            style={chip(nina.edad === edad)}
                          >
                            {edad}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={addNina}
                    className="flex items-center gap-2 text-sm font-semibold hover:opacity-70 transition-opacity"
                    style={{ color: C.burgundy, fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif" }}
                  >
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-sm"
                      style={{ backgroundColor: C.blush, color: C.burgundy }}
                    >
                      +
                    </span>
                    Añadir otra niña
                  </button>
                </div>
              )}
            </div>

            {/* ── Alergias ── */}
            <div>
              <SectionLabel text="Alergias o intolerancias" optional />
              <textarea
                style={{
                  ...inputStyle(),
                  resize: "none",
                  minHeight: "80px",
                }}
                placeholder="Por ejemplo: sin gluten, frutos secos... (déjalo en blanco si no hay nada)"
                value={alergias}
                onChange={e => setAlergias(e.target.value)}
              />
            </div>

            {/* ── Error ── */}
            {errorMsg && (
              <p className="text-sm text-red-600">{errorMsg}</p>
            )}

            {/* ── Submit ── */}
            <button
              onClick={handleSubmit}
              disabled={!formValido || enviando}
              className="w-full py-4 rounded-2xl text-sm font-semibold uppercase tracking-widest transition-all"
              style={{
                backgroundColor: formValido ? C.burgundy : C.border,
                color: "#fff8f5",
                fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif",
                letterSpacing: "0.1em",
                cursor: formValido ? "pointer" : "not-allowed",
                opacity: enviando ? 0.7 : 1,
              }}
            >
              {enviando ? "Enviando..." : "Reservar mi plaza"}
            </button>

            <p className="text-xs text-center" style={{ color: C.muted }}>
              Solo usamos tus datos para confirmar tu asistencia. Sin spam.
            </p>
          </div>
        </div>
        </div>{/* /columna formulario */}

        </div>{/* /grid */}
      </div>{/* /cuerpo */}

    </div>
  );
}

function SectionLabel({ text, optional, required }: { text: string; optional?: boolean; required?: boolean }) {
  return (
    <p
      className="text-xs font-semibold uppercase tracking-[0.12em] mb-3 flex items-center gap-2"
      style={{ color: C.burgundy, fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif" }}
    >
      {text}
      {required && (
        <span aria-hidden="true" style={{ color: "#c0392b" }}>*</span>
      )}
      {optional && (
        <span
          className="normal-case tracking-normal font-normal text-xs"
          style={{ color: C.muted }}
        >
          (opcional)
        </span>
      )}
    </p>
  );
}
