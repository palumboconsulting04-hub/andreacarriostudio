"use client";

import { useState } from "react";
import Image from "next/image";

type Nina = { nombre: string; edad: string };

const DISCIPLINAS = [
  { value: "pilates", label: "Pilates Reformer" },
  { value: "barre", label: "Barre" },
  { value: "ballet-adultas", label: "Ballet Adultas" },
  { value: "acompanar", label: "Solo vengo a acompañar" },
];

const EDAD_NINA_OPTIONS = ["3–4 años", "5–6 años", "7–9 años", "10–12 años"];

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
    fontSize: "0.9rem",
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

  const ninasOk = traeNina === true
    ? ninas.every(n => n.nombre.trim() !== "" && n.edad !== "")
    : true;

  const formValido =
    nombre.trim() !== "" &&
    apellido.trim() !== "" &&
    email.trim() !== "" &&
    telefono.trim() !== "" &&
    disciplina !== "" &&
    traeNina !== null &&
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
        <p className="text-base max-w-md leading-relaxed mb-10" style={{ color: C.brown }}>
          Me alegra mucho que quieras venir. En breve te escribo con todos los detalles para que estés lista el día de las Puertas Abiertas.<br /><br />
          ¡Hasta pronto!<br />
          <strong>Andrea</strong>
        </p>
        <a
          href="/"
          className="text-sm uppercase tracking-widest hover:opacity-70 transition-opacity"
          style={{ color: C.muted, fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif" }}
        >
          Volver al inicio
        </a>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: C.bg, minHeight: "100vh" }}>

      {/* ── Hero ── */}
      <div
        className="relative overflow-hidden px-6 py-16 sm:py-24 text-center"
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
            width={100}
            height={100}
            className="mx-auto mb-8 rounded-full"
            style={{ objectFit: "contain" }}
          />

          <p
            className="text-xs uppercase tracking-[0.25em] mb-4"
            style={{ color: C.muted, fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif" }}
          >
            Andrea Carrió Studio · Alfauir, Valencia
          </p>

          <h1
            className="text-5xl sm:text-6xl mb-6 leading-tight"
            style={{ fontFamily: "var(--font-playfair), 'Playfair Display', Georgia, serif", color: C.burgundy }}
          >
            Puertas<br />Abiertas
          </h1>

          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="h-px flex-1 max-w-[60px]" style={{ backgroundColor: C.border }} />
            <span className="text-lg" style={{ color: C.blush }}>✦</span>
            <div className="h-px flex-1 max-w-[60px]" style={{ backgroundColor: C.border }} />
          </div>

          <p
            className="text-base sm:text-lg leading-relaxed max-w-md mx-auto"
            style={{ color: C.brown }}
          >
            Quiero que conozcas el estudio antes de decidir. Ven a probar una clase, muévete, y siéntelo por ti misma. No hace falta saber bailar — solo tener ganas.
          </p>
        </div>
      </div>

      {/* ── Andrea / La escuela ── */}
      <div className="max-w-xl mx-auto px-4 pt-12">
        <div
          className="rounded-3xl p-7 sm:p-8 flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left"
          style={{ backgroundColor: "#ffffff", border: `1px solid ${C.border}` }}
        >
          {/* TODO: sustituir por la foto real de Andrea (guardar en public/andrea.jpg y cambiar src) */}
          <Image
            src="/ballet-adultos.png"
            alt="Andrea Carrió"
            width={110}
            height={110}
            className="rounded-full flex-shrink-0"
            style={{ objectFit: "cover", objectPosition: "50% 22%", width: 110, height: 110 }}
          />
          <div>
            <p
              className="text-xs uppercase tracking-[0.2em] mb-1.5"
              style={{ color: C.muted, fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif" }}
            >
              Soy Andrea
            </p>
            <p className="text-sm leading-relaxed" style={{ color: C.brown }}>
              Durante años he sido la profesora de ballet de esta escuela, en la{" "}
              <strong style={{ color: C.burgundy }}>Calle Motilla del Palancar, 34</strong>{" "}
              (la que muchas conocéis como la escuela de Maricruz Alcalá). Hoy tomo el relevo y la hago
              completamente mía, con la misma ilusión de siempre y un objetivo claro:{" "}
              <strong style={{ color: C.burgundy }}>
                ballet para niñas con rigor académico, siguiendo el método RAD (Royal Academy of Dance).
              </strong>
            </p>
          </div>
        </div>
      </div>

      {/* ── Form ── */}
      <div className="max-w-xl mx-auto px-4 pb-20 mt-8">
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
          <p className="text-sm mb-8" style={{ color: C.muted }}>
            Es gratuito y sin compromiso. Solo necesito saber que venís.
          </p>

          <div className="space-y-8">

            {/* ── Datos personales ── */}
            <div>
              <SectionLabel text="Tus datos" />
              <div className="grid grid-cols-2 gap-3 mb-3">
                <input
                  style={inputStyle()}
                  placeholder="Nombre"
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                />
                <input
                  style={inputStyle()}
                  placeholder="Apellido"
                  value={apellido}
                  onChange={e => setApellido(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  style={inputStyle()}
                  placeholder="Email"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
                <input
                  style={inputStyle()}
                  placeholder="Teléfono"
                  type="tel"
                  value={telefono}
                  onChange={e => setTelefono(e.target.value)}
                />
              </div>
            </div>

            {/* ── Disciplina ── */}
            <div>
              <SectionLabel text="¿Qué te apetece probar?" />
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
              <SectionLabel text="¿Traes a tu hija?" />
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
                        placeholder="Nombre de tu hija"
                        value={nina.nombre}
                        onChange={e => updateNina(i, "nombre", e.target.value)}
                      />
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
      </div>

    </div>
  );
}

function SectionLabel({ text, optional }: { text: string; optional?: boolean }) {
  return (
    <p
      className="text-xs font-semibold uppercase tracking-[0.12em] mb-3 flex items-center gap-2"
      style={{ color: C.burgundy, fontFamily: "var(--font-montserrat), 'Montserrat', sans-serif" }}
    >
      {text}
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
