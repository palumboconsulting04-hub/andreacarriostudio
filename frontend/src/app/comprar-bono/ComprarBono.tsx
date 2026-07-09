"use client";

import { useState, useEffect } from "react";
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
      <div className="max-w-2xl mx-auto">
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
            <p className="text-center text-xs mb-4" style={{ color: C.burgundy, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>{DISC[disciplina]}</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              {bonos.map(b => {
                const activo = sel?.id === b.id;
                const porClase = b.precio / b.creditos;
                return (
                  <button key={b.id} onClick={() => setSel(b)} className="text-center rounded-2xl p-5 transition-all hover:-translate-y-0.5"
                    style={{ border: `2px solid ${activo ? C.burgundy : C.border}`, backgroundColor: activo ? C.blush : "#fff", cursor: "pointer" }}>
                    <p className="text-sm font-bold mb-2" style={{ color: C.dark, fontFamily: fSans }}>{b.nombre}</p>
                    <p className="text-3xl font-bold leading-none" style={{ color: C.burgundy }}>{b.precio}€</p>
                    <p className="text-xs mt-1.5" style={{ color: C.muted }}>{porClase.toFixed(0)}€ / clase</p>
                    <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${activo ? "#e6b8a8" : C.border}` }}>
                      <p className="text-xs font-semibold" style={{ color: C.brown }}>{b.creditos === 1 ? "1 clase" : `${b.creditos} clases`}</p>
                      <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>válido {b.validezMeses} {b.validezMeses === 1 ? "mes" : "meses"}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {sel && (
              <div className="rounded-3xl p-6 shadow-sm space-y-3 max-w-md mx-auto" style={{ backgroundColor: "#fff", border: `2px solid ${C.burgundy}` }}>
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
    </div>
  );
}
