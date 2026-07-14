"use client";

import { useState, useEffect } from "react";
import CompartirCodigo from "@/components/CompartirCodigo";

const C = { burgundy: "#7d2b13", blush: "#ffdbd1", cream: "#fff8f5", bg: "#f5ede8", brown: "#56423d", muted: "#89726c", border: "#dcc1b9", dark: "#25190f" };
const fSerif = "var(--font-playfair), 'Playfair Display', Georgia, serif";
const fSans = "var(--font-montserrat), 'Montserrat', sans-serif";

type Data = { codigo: string; nombre: string; totalAmigas: number; premios: { detalle: string; fecha: string }[] };

const inputStyle = { border: `1.5px solid ${C.border}`, borderRadius: "12px", padding: "12px 16px", fontSize: "16px", fontFamily: fSans, color: C.dark, backgroundColor: C.cream, outline: "none", width: "100%" } as const;

export default function Invita() {
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [cargando, setCargando] = useState(false);
  const [autocargando, setAutocargando] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<Data | null>(null);

  const verCon = async (em: string, nom: string, tok = "") => {
    setCargando(true);
    setError("");
    try {
      const res = await fetch("/api/referido/mi-codigo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: em.trim(), nombre: nom.trim(), token: tok }),
      });
      const d = await res.json();
      if (!res.ok) setError(d.error ?? "No se pudo obtener tu código.");
      else setData(d as Data);
    } catch {
      setError("No se pudo conectar. Inténtalo de nuevo.");
    } finally {
      setCargando(false);
      setAutocargando(false);
    }
  };

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const e = p.get("email");
    const t = p.get("t");
    if (e) setEmail(e);
    // Enlace mágico: si trae email + token, abre el código directo (sin login).
    if (e && t) { setAutocargando(true); verCon(e, "", t); }
  }, []);

  const emailOk = /\S+@\S+\.\S+/.test(email.trim());
  const puede = emailOk && !!nombre.trim() && !cargando;
  const ver = () => { if (puede) verCon(email, nombre); };

  return (
    <div style={{ backgroundColor: C.bg, minHeight: "100vh" }} className="px-4 py-12">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl sm:text-4xl text-center mb-2" style={{ fontFamily: fSerif, color: C.burgundy }}>Invita a una amiga</h1>
        <p className="text-center text-sm mb-8" style={{ color: C.muted }}>Comparte tu código y ganáis las dos.</p>

        {!data && autocargando ? (
          <div className="rounded-3xl p-8 text-center" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}`, color: C.muted }}>Un momento…</div>
        ) : !data ? (
          <div className="rounded-3xl p-6 shadow-sm space-y-3" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}` }}>
            <p className="text-sm mb-1" style={{ color: C.brown }}>Entra con el correo y el nombre de tu inscripción o de tu bono.</p>
            <input style={inputStyle} placeholder="Tu email *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <input style={inputStyle} placeholder="Tu nombre *" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button onClick={ver} disabled={!puede}
              className="w-full py-4 rounded-2xl text-sm font-semibold uppercase tracking-widest transition-all"
              style={{ backgroundColor: puede ? C.burgundy : C.border, color: "#fff8f5", fontFamily: fSans, letterSpacing: "0.08em", cursor: puede ? "pointer" : "not-allowed" }}>
              {cargando ? "Un momento…" : "Ver mi código"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-3xl p-6 text-center" style={{ backgroundColor: "#fff6f2", border: `1px solid ${C.burgundy}` }}>
              <p className="text-sm font-bold mb-1" style={{ color: C.burgundy, fontFamily: fSans }}>Tu código{data.nombre ? `, ${data.nombre}` : ""}</p>
              <p className="text-xs mb-3" style={{ color: C.brown }}>Cuando tu amiga lo use al sacar su bono o su mensualidad, ganáis las dos.</p>
              <span className="block text-lg font-bold tracking-widest py-3 rounded-xl mb-4" style={{ backgroundColor: "#fff", border: `1px dashed ${C.burgundy}`, color: C.burgundy }}>{data.codigo}</span>
              <CompartirCodigo codigo={data.codigo} />
            </div>

            <div className="rounded-3xl p-6" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}` }}>
              <p className="text-sm font-bold mb-2" style={{ color: C.burgundy, fontFamily: fSans }}>Tu progreso</p>
              <p className="text-sm" style={{ color: C.brown }}>
                Has traído <strong style={{ color: C.dark }}>{data.totalAmigas}</strong> {data.totalAmigas === 1 ? "amiga" : "amigas"}.
              </p>
              {data.premios.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {data.premios.map((p, i) => (
                    <span key={i} className="text-xs px-3 py-1.5 rounded-full" style={{ backgroundColor: "#e8f5e9", color: "#2e7d32" }}>✓ {p.detalle}</span>
                  ))}
                </div>
              ) : (
                <p className="text-xs mt-2" style={{ color: C.muted }}>Cuando una amiga entre con tu código, tu premio aparecerá aquí.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
