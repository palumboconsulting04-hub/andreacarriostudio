"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { fetchBonos, type BonoTipo } from "@/lib/queries";

const DISC: Record<string, string> = { "barre-fit": "Barre Fit", "pilates-mat": "Pilates Mat" };
const inputStyle: React.CSSProperties = { backgroundColor: "#fff8f5", border: "1.5px solid #dcc1b9", borderRadius: 12, padding: "12px 16px", fontSize: 16, color: "#25190f", outline: "none", width: "100%" };

export default function ComprarBono() {
  const params = useSearchParams();
  const dParam = params.get("disciplina") ?? "";
  const ref = params.get("ref") ?? ""; // código de madrina (viene de un enlace de referido)
  const [disciplina, setDisciplina] = useState(["barre-fit", "pilates-mat"].includes(dParam) ? dParam : "");
  const [bonos, setBonos] = useState<BonoTipo[]>([]);
  const [sel, setSel] = useState<BonoTipo | null>(null);
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

  // Trae a tu amiga: guarda el código (para el +1 de regalo) y registra la apertura
  // del enlace una sola vez por navegador. No muestra nada en pantalla.
  useEffect(() => {
    if (!ref) return;
    try {
      sessionStorage.setItem("acs_ref", ref);
      const key = `acs_ref_visit_${ref}`;
      let yaContado = false;
      try { yaContado = !!localStorage.getItem(key); } catch {}
      if (!yaContado) {
        try { localStorage.setItem(key, "1"); } catch {}
        fetch("/api/referido/visita", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ codigo: ref, session_id: sessionStorage.getItem("acs_fsid") || null, canal: params.get("c") || null }),
        }).catch(() => {});
      }
    } catch { /* sessionStorage no disponible */ }
  }, [ref]);

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
        body: JSON.stringify({ bono_tipo_id: sel!.id, nombre: nombre.trim(), email: email.trim(), telefono: telefono.trim(), ref }),
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
    if (sel) { setSel(null); return; }
    const dParamValido = ["barre-fit", "pilates-mat"].includes(dParam);
    if (disciplina && !dParamValido) { setDisciplina(""); return; }
    window.history.back();
  };

  const precioSuelta = bonos.find(x => x.creditos === 1)?.precio ?? 0;
  const antesDeSep = new Date().toISOString().slice(0, 10) < "2026-09-01";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#fff8f5", color: "#25190f" }}>
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* breadcrumb */}
        <div className="flex items-center gap-2 mb-8">
          <button onClick={volver} className="flex items-center gap-1.5 font-body text-sm text-texto-muted hover:text-siena transition-colors">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Volver
          </button>
          {disciplina && (<><span className="text-outline-light">/</span><span className="font-body text-sm text-texto">{DISC[disciplina]}</span></>)}
        </div>

        {/* heading */}
        <div className="text-center mb-10">
          <h1 className="font-display text-4xl sm:text-5xl text-siena mb-3">Bonos flexibles</h1>
          <p className="font-body text-texto-muted text-base">Compra créditos y ven cuando puedas. 1 crédito = 1 clase.</p>
          {antesDeSep && (
            <p className="font-body text-xs mt-3 text-siena">Los bonos empiezan el <strong>1 de septiembre</strong> · la validez cuenta desde esa fecha.</p>
          )}
        </div>

        {!disciplina ? (
          <div className="max-w-sm mx-auto">
            <p className="font-body text-center text-sm font-semibold text-siena mb-4">¿Para qué disciplina?</p>
            <div className="grid gap-4 sm:grid-cols-2">
              {(["barre-fit", "pilates-mat"] as const).map(d => (
                <button key={d} onClick={() => setDisciplina(d)}
                  className="group rounded-3xl p-6 border border-outline-light bg-white hover:border-siena-pale hover:-translate-y-1 shadow-sm hover:shadow-md transition-all duration-300 text-center">
                  <span className="font-display text-xl font-semibold text-siena">{DISC[d]}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className={`grid gap-5 ${bonos.length === 1 ? "max-w-sm mx-auto" : bonos.length === 2 ? "grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto" : "grid-cols-1 sm:grid-cols-3"}`}>
              {bonos.map(b => {
                const activo = sel?.id === b.id;
                const destacado = b.creditos === 5;
                const porClase = (b.precio / b.creditos).toLocaleString("es-ES", { maximumFractionDigits: 1 });
                const ahorro = Math.max(0, b.creditos * precioSuelta - b.precio);
                const feats = [
                  b.creditos === 1 ? "1 clase para probar" : `${b.creditos} clases · 1 crédito = 1 clase`,
                  `Solo clases de ${DISC[disciplina]}`,
                  `Válido ${b.validezMeses} ${b.validezMeses === 1 ? "mes" : "meses"} desde la compra`,
                  "Reservas el día que quieras",
                  "Cancela hasta 4 h antes y recuperas el crédito",
                  ...(ahorro > 0 ? [`Ahorras ${ahorro}€ frente a clases sueltas`] : []),
                ];
                return (
                  <button key={b.id} onClick={() => setSel(activo ? null : b)}
                    className={`group relative text-left rounded-3xl p-7 border transition-all duration-300 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-siena focus:ring-offset-2 ${destacado ? "bg-siena border-siena text-white shadow-lg" : `bg-white shadow-sm hover:shadow-md ${activo ? "border-siena" : "border-outline-light hover:border-siena-pale"}`}`}>
                    {destacado && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-terracota-light text-texto font-body font-semibold tracking-widest uppercase px-3 py-1 rounded-full shadow" style={{ fontSize: "10px" }}>Más popular</span>
                    )}
                    <div className="mb-5">
                      <p className={`font-body text-xs tracking-widest uppercase font-semibold mb-2 ${destacado ? "text-siena-light" : "text-outline"}`}>{b.nombre}</p>
                      <div className="flex items-end gap-1">
                        <span className={`font-display text-5xl font-semibold ${destacado ? "text-white" : "text-siena"}`}>{b.precio}€</span>
                      </div>
                      <p className={`font-body text-sm mt-1 ${destacado ? "text-siena-pale" : "text-texto-muted"}`}>{porClase}€ por clase</p>
                    </div>
                    <ul className="space-y-2.5 mb-7">
                      {feats.map(f => (
                        <li key={f} className="flex items-start gap-2.5">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={`mt-0.5 shrink-0 ${destacado ? "text-siena-light" : "text-siena"}`}><path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                          <span className={`font-body text-sm leading-snug ${destacado ? "text-siena-pale" : "text-texto-muted"}`}>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <span className={`inline-flex items-center justify-center w-full gap-2 py-3 rounded-full font-body text-sm font-semibold tracking-wider uppercase transition-all duration-200 ${destacado ? "bg-white text-siena group-hover:bg-siena-pale" : "bg-siena text-white group-hover:bg-siena-container"}`}>
                      {activo ? "Seleccionado ✓" : "Elegir bono"}
                      {!activo && <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="transition-transform group-hover:translate-x-1"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </span>
                  </button>
                );
              })}
            </div>

            {sel && (
              <div ref={formRef} className="mt-10 rounded-3xl p-7 max-w-md mx-auto bg-white border border-outline-light shadow-sm scroll-mt-4">
                <p className="font-display text-2xl font-semibold text-siena mb-1">Tus datos</p>
                <p className="font-body text-sm text-texto-muted mb-5">{sel.nombre} · {sel.precio}€</p>
                <div className="space-y-3">
                  <input style={inputStyle} className="font-body" placeholder="Nombre y apellidos *" value={nombre} onChange={e => setNombre(e.target.value)} />
                  <input style={inputStyle} className="font-body" placeholder="Email * (con este entrarás a reservar)" type="email" value={email} onChange={e => setEmail(e.target.value)} />
                  <input style={inputStyle} className="font-body" placeholder="WhatsApp *" type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} />
                </div>
                {error && <p className="font-body text-sm text-red-600 mt-3">{error}</p>}
                {ref && (<p className="font-body text-xs text-center mt-3 text-siena">🎁 +1 clase de regalo por venir de una amiga</p>)}
                <button onClick={pagar} disabled={!formValido || enviando}
                  className="w-full mt-5 py-4 rounded-full font-body text-sm font-semibold tracking-wider uppercase transition-all bg-siena text-white hover:bg-siena-container disabled:opacity-50"
                  style={{ cursor: formValido ? "pointer" : "not-allowed" }}>
                  {enviando ? "Redirigiendo al pago..." : `Pagar ${sel.precio}€ →`}
                </button>
                <p className="font-body text-xs text-center mt-3 text-texto-muted">Pago seguro con Stripe. Después reservas tus clases desde tu panel.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
