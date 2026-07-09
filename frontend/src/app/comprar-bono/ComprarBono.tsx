"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { fetchBonos, type BonoTipo } from "@/lib/queries";

const C = {
  burgundy: "#7d2b13", blush: "#ffdbd1", cream: "#fff8f5", bg: "#f5ede8",
  brown: "#56423d", dark: "#25190f", muted: "#89726c", border: "#dcc1b9",
};
const fSerif = "var(--font-playfair), 'Playfair Display', Georgia, serif";
const fSans = "var(--font-montserrat), 'Montserrat', sans-serif";
const DISC: Record<string, string> = { "barre-fit": "Barre Fit", "pilates-mat": "Pilates Mat" };

export default function ComprarBono() {
  const params = useSearchParams();
  const dParam = params.get("disciplina") ?? "";
  const [disciplina, setDisciplina] = useState(["barre-fit", "pilates-mat"].includes(dParam) ? dParam : "");
  const [bonos, setBonos] = useState<BonoTipo[]>([]);
  const [sel, setSel] = useState<BonoTipo | null>(null);
  const [detalle, setDetalle] = useState<BonoTipo | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setSel(null);
    if (!disciplina) { setBonos([]); return; }
    fetchBonos(disciplina).then(setBonos).catch(() => setBonos([]));
  }, [disciplina]);

  // Al elegir un bono, baja suave al formulario de datos.
  useEffect(() => {
    if (sel) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [sel]);

  const emailOk = /\S+@\S+\.\S+/.test(email.trim());
  const formValido = !!sel && !!nombre.trim() && !!telefono.trim() && emailOk;

  const pagar = async () => {
    if (!formValido || enviando) return;
    setEnviando(true);
    setError("");
    try {
      const res = await fetch("/api/create-bono-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bono_tipo_id: sel!.id, nombre: nombre.trim(), email: email.trim(), telefono: telefono.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || "");
      window.location.href = data.url;
    } catch {
      setError("No se pudo iniciar el pago. Inténtalo de nuevo.");
      setEnviando(false);
    }
  };

  // Volver al paso anterior, sea cual sea la fase.
  const volver = () => {
    if (sel) { setSel(null); return; }                                  // formulario → catálogo
    const dParamValido = ["barre-fit", "pilates-mat"].includes(dParam);
    if (disciplina && !dParamValido) { setDisciplina(""); return; }     // catálogo → elegir disciplina
    window.history.back();                                              // → volver al paso anterior (funnel)
  };

  const inputStyle = { border: `1.5px solid ${C.border}`, borderRadius: "12px", padding: "12px 16px", fontSize: "16px", fontFamily: fSans, color: C.dark, backgroundColor: C.cream, outline: "none", width: "100%" };

  return (
    <div style={{ backgroundColor: C.bg, minHeight: "100vh" }} className="px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <button onClick={volver} className="flex items-center gap-1.5 text-sm mb-5 transition-opacity hover:opacity-70" style={{ color: C.muted, fontFamily: fSans }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Volver
        </button>
        <h1 className="text-3xl sm:text-4xl text-center mb-1" style={{ fontFamily: fSerif, color: C.burgundy }}>Bonos flexibles</h1>
        <p className="text-center text-sm mb-7" style={{ color: C.muted }}>
          Compra créditos y ven cuando puedas. 1 crédito = 1 clase.
        </p>

        {!disciplina ? (
          <div className="rounded-3xl p-6 shadow-sm max-w-sm mx-auto" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}` }}>
            <p className="text-sm font-bold mb-3 text-center" style={{ color: C.burgundy, fontFamily: fSans }}>¿Para qué disciplina?</p>
            <div className="flex flex-col gap-2.5">
              {(["barre-fit", "pilates-mat"] as const).map(d => (
                <button key={d} onClick={() => setDisciplina(d)} className="w-full rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all"
                  style={{ border: `2px solid ${C.border}`, backgroundColor: C.cream, color: C.dark, cursor: "pointer" }}>
                  {DISC[d]}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-center mb-8">
              <span className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest" style={{ backgroundColor: C.blush, color: C.burgundy }}>{DISC[disciplina]}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 pt-3 items-stretch">
              {bonos.map(b => {
                const activo = sel?.id === b.id;
                const porClase = b.precio / b.creditos;
                const destacado = b.creditos === 5;
                const tagline = b.creditos === 1 ? "Para probar 👋" : b.creditos <= 5 ? "Para coger el hábito 🌱" : "Para las constantes 🔥";
                const feats = [
                  b.creditos === 1 ? "1 clase de prueba" : `${b.creditos} clases`,
                  `Válido ${b.validezMeses} ${b.validezMeses === 1 ? "mes" : "meses"}`,
                  "Reserva el día que quieras",
                ];
                return (
                  <div key={b.id} className="relative rounded-3xl p-6 flex flex-col text-center transition-all"
                    style={{
                      border: `2px solid ${activo || destacado ? C.burgundy : C.border}`,
                      backgroundColor: activo ? C.blush : destacado ? "#fff6f2" : "#fff",
                      boxShadow: destacado ? "0 14px 34px rgba(125,43,19,0.16)" : "0 3px 12px rgba(37,25,15,0.05)",
                    }}>
                    {destacado && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap shadow" style={{ backgroundColor: C.burgundy, color: C.cream }}>★ Más popular</span>}
                    <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: C.muted }}>{b.nombre}</p>
                    <div className="flex items-start justify-center gap-0.5">
                      <span className="text-5xl font-bold leading-none" style={{ color: C.burgundy }}>{b.precio}</span>
                      <span className="text-xl font-bold mt-1" style={{ color: C.burgundy }}>€</span>
                    </div>
                    <p className="text-xs mt-2" style={{ color: C.muted }}>{porClase.toFixed(0)}€ por clase</p>
                    <span className="inline-block mt-2.5 px-3 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: "#fff1e9", color: C.burgundy }}>{tagline}</span>
                    <div className="mt-5 mb-5 space-y-2 text-left">
                      {feats.map(f => (
                        <div key={f} className="flex items-center gap-2">
                          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" className="shrink-0"><path d="M3 8l3.5 3.5L13 5" stroke={C.burgundy} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          <span className="text-xs" style={{ color: C.brown }}>{f}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-auto flex flex-col gap-1.5">
                      <button onClick={() => setSel(activo ? null : b)} className="text-xs font-bold py-3 rounded-full uppercase tracking-wider transition-transform hover:scale-[1.02]" style={{ backgroundColor: C.burgundy, color: C.cream }}>{activo ? "Deseleccionar ✕" : "Elegir"}</button>
                      <button onClick={() => setDetalle(b)} className="text-xs font-semibold py-1.5" style={{ color: C.muted, background: "none" }}>Ver detalles</button>
                    </div>
                  </div>
                );
              })}
            </div>

            {sel && (
              <div ref={formRef} className="rounded-3xl p-6 shadow-sm space-y-3 max-w-md mx-auto scroll-mt-4" style={{ backgroundColor: "#fff", border: `2px solid ${C.burgundy}` }}>
                <p className="text-sm font-bold" style={{ color: C.burgundy, fontFamily: fSans }}>Tus datos</p>
                <input style={inputStyle} placeholder="Nombre y apellidos *" value={nombre} onChange={e => setNombre(e.target.value)} />
                <input style={inputStyle} placeholder="Email * (con este entrarás a reservar)" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                <input style={inputStyle} placeholder="WhatsApp *" type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} />
                {error && <p className="text-sm text-red-600">{error}</p>}
                <button onClick={pagar} disabled={!formValido || enviando}
                  className="w-full py-4 rounded-2xl text-sm font-semibold uppercase tracking-widest transition-all"
                  style={{ backgroundColor: formValido ? C.burgundy : C.border, color: "#fff8f5", fontFamily: fSans, letterSpacing: "0.08em", cursor: formValido ? "pointer" : "not-allowed", opacity: enviando ? 0.7 : 1 }}>
                  {enviando ? "Redirigiendo al pago..." : `Pagar ${sel.precio}€ →`}
                </button>
                <p className="text-xs text-center" style={{ color: C.muted }}>Pago seguro con Stripe. Después reservas tus clases desde tu panel.</p>
              </div>
            )}
          </>
        )}
      </div>

      {detalle && (() => {
        const precioSuelta = bonos.find(x => x.creditos === 1)?.precio ?? 0;
        const ahorro = Math.max(0, detalle.creditos * precioSuelta - detalle.precio);
        const dl = DISC[detalle.disciplinaId] ?? detalle.disciplinaId;
        const item = (icon: string, texto: string) => (
          <div className="flex items-start gap-2.5">
            <span className="text-base leading-6">{icon}</span>
            <span className="text-sm" style={{ color: C.brown }}>{texto}</span>
          </div>
        );
        return (
          <div onClick={() => setDetalle(null)} className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ backgroundColor: "rgba(37,25,15,0.55)" }}>
            <div onClick={e => e.stopPropagation()} className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl" style={{ backgroundColor: "#fff" }}>
              <div className="p-6 pb-5" style={{ background: "linear-gradient(135deg,#fff0eb,#fff8f5)" }}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xl font-bold" style={{ color: C.dark, fontFamily: fSans }}>{detalle.nombre}</p>
                    <p className="text-xs mt-0.5 font-semibold uppercase tracking-widest" style={{ color: C.burgundy }}>{dl}</p>
                  </div>
                  <button onClick={() => setDetalle(null)} className="w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0" style={{ backgroundColor: "#fff", color: C.muted }} aria-label="Cerrar">✕</button>
                </div>
                <p className="text-4xl font-bold mt-4" style={{ color: C.burgundy }}>{detalle.precio}€</p>
                <p className="text-sm" style={{ color: C.muted }}>{(detalle.precio / detalle.creditos).toFixed(0)}€ por clase{ahorro > 0 ? ` · ahorras ${ahorro}€` : ""}</p>
              </div>
              <div className="p-6 space-y-3">
                {item("🎟️", `${detalle.creditos === 1 ? "1 clase" : `${detalle.creditos} clases`} · 1 crédito = 1 clase`)}
                {item("📅", `Válido ${detalle.validezMeses} ${detalle.validezMeses === 1 ? "mes" : "meses"} desde la compra`)}
                {item("🗓️", "Reservas el día que quieras desde tu panel")}
                {item("↩️", "Cancela hasta 24 h antes y recupera el crédito")}
                {ahorro > 0 && item("💚", `Ahorras ${ahorro}€ frente a comprar clases sueltas`)}
                <p className="text-sm leading-relaxed pt-1" style={{ color: C.muted }}>
                  Bono de {detalle.creditos} {detalle.creditos === 1 ? "sesión" : "sesiones"} de {dl}, para usar cuando puedas. Ideal si no quieres atarte a una rutina fija.
                </p>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setDetalle(null)} className="flex-1 py-3 rounded-2xl text-sm font-semibold" style={{ border: `1.5px solid ${C.border}`, color: C.brown, backgroundColor: "#fff" }}>Cancelar</button>
                  <button onClick={() => { setSel(detalle); setDetalle(null); }} className="flex-1 py-3 rounded-2xl text-sm font-bold uppercase tracking-wider" style={{ backgroundColor: C.burgundy, color: C.cream }}>Elegir →</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
