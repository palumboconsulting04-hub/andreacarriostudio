"use client";

import { useState, useEffect } from "react";
import { SLOTS, EVENTO, slotById } from "@/lib/jornada";

const C = {
  burgundy: "#7d2b13", blush: "#ffdbd1", cream: "#fff8f5", bg: "#f5ede8",
  brown: "#56423d", dark: "#25190f", muted: "#89726c", border: "#dcc1b9",
};
const fSerif = "var(--font-playfair), 'Playfair Display', Georgia, serif";
const fSans = "var(--font-montserrat), 'Montserrat', sans-serif";

type Disp = { id: string; ocupadas: number; libres: number };

export default function ReservarJornada() {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [slotId, setSlotId] = useState("");
  const [disp, setDisp] = useState<Record<string, Disp>>({});
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const cargar = () => {
    fetch("/api/reservar-jornada")
      .then(r => r.json())
      .then(({ slots }) => {
        const m: Record<string, Disp> = {};
        for (const s of (slots ?? []) as Disp[]) m[s.id] = s;
        setDisp(m);
      })
      .catch(() => {});
  };
  useEffect(cargar, []);

  const formValido = nombre.trim() && telefono.trim() && slotId;

  const handleSubmit = async () => {
    if (!formValido || enviando) return;
    setEnviando(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/reservar-jornada", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), telefono: telefono.trim(), email: email.trim(), slot_id: slotId }),
      });
      if (res.status === 409) {
        const d = await res.json();
        setErrorMsg(d.message || "Ese turno se ha llenado. Elige otro.");
        setSlotId("");
        cargar();
        return;
      }
      if (!res.ok) throw new Error();
      setEnviado(true);
    } catch {
      setErrorMsg("Ha habido un problema. Inténtalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  if (enviado) {
    const s = slotById(slotId);
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center" style={{ backgroundColor: C.bg }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center mb-8" style={{ backgroundColor: C.blush }}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none"><path d="M7 18l8 8L29 10" stroke={C.burgundy} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h2 className="text-4xl sm:text-5xl mb-5" style={{ fontFamily: fSerif, color: C.burgundy }}>¡Hora reservada!</h2>
        <p className="text-base max-w-md leading-relaxed mb-2" style={{ color: C.brown }}>
          Te esperamos el <strong>{EVENTO.fecha}</strong>:
        </p>
        {s && (
          <p className="text-lg font-bold mb-8" style={{ color: C.burgundy, fontFamily: fSans }}>
            {s.titulo} · {s.hora}
          </p>
        )}
        <p className="text-sm max-w-md leading-relaxed" style={{ color: C.brown }}>
          Si quieres probar también la otra disciplina, puedes reservar otra hora.<br />
          ¡Nos vemos! <strong>Andrea</strong>
        </p>
      </div>
    );
  }

  const bloque = (titulo: string, sub: string, ids: string[]) => (
    <div className="mb-6">
      <p className="text-sm font-bold mb-1" style={{ color: C.burgundy, fontFamily: fSans }}>{titulo}</p>
      <p className="text-xs mb-3" style={{ color: C.muted }}>{sub}</p>
      <div className="flex flex-col gap-2.5">
        {ids.map(id => {
          const s = slotById(id)!;
          const d = disp[id];
          const libres = d ? d.libres : s.tope;
          const lleno = libres <= 0;
          const sel = slotId === id;
          return (
            <button
              key={id}
              onClick={() => !lleno && setSlotId(id)}
              disabled={lleno}
              className="w-full text-left rounded-2xl px-4 py-3 transition-all flex items-center justify-between"
              style={{
                border: `2px solid ${sel ? C.burgundy : C.border}`,
                backgroundColor: lleno ? "#f0eae6" : sel ? C.blush : C.cream,
                opacity: lleno ? 0.6 : 1, cursor: lleno ? "not-allowed" : "pointer", outline: "none",
              }}
            >
              <span>
                <span className="block text-sm font-semibold" style={{ color: sel ? C.burgundy : C.dark, fontFamily: fSans }}>{s.titulo}</span>
                <span className="block text-xs" style={{ color: C.muted }}>{s.hora}</span>
              </span>
              <span className="text-xs font-semibold" style={{ color: lleno ? "#b71c1c" : "#1f7a3d" }}>
                {lleno ? "COMPLETO" : `${libres} libres`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const inputStyle = { border: `1.5px solid ${C.border}`, borderRadius: "12px", padding: "12px 16px", fontSize: "16px", fontFamily: fSans, color: C.dark, backgroundColor: C.cream, outline: "none", width: "100%" };

  return (
    <div style={{ backgroundColor: C.bg, minHeight: "100vh" }} className="px-4 py-10">
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl sm:text-4xl text-center mb-1" style={{ fontFamily: fSerif, color: C.burgundy }}>{EVENTO.titulo}</h1>
        <p className="text-center text-sm mb-1" style={{ color: C.dark, fontFamily: fSans, fontWeight: 600 }}>{EVENTO.fecha} · Valencia (Zona Alfahuir)</p>
        <p className="text-center text-sm mb-7" style={{ color: C.muted }}>Elige la hora que mejor te venga 👇</p>

        <div className="rounded-3xl p-6 shadow-sm mb-5" style={{ backgroundColor: "#ffffff", border: `1px solid ${C.border}` }}>
          {bloque("🌅 NIÑAS · Mañana", "Clases de prueba de ballet para peques.", ["nin-pre-1", "nin-pre-2", "nin-ballet"])}
          {bloque("🌆 ADULTAS · Tarde", "Barre Fit y Pilates Mat. ¿Quieres las dos? Reserva una hora de cada una.", ["adu-barre-1", "adu-pilates-1", "adu-barre-2", "adu-pilates-2"])}
        </div>

        <div className="rounded-3xl p-6 shadow-sm space-y-3" style={{ backgroundColor: "#ffffff", border: `2px solid ${C.burgundy}` }}>
          <input style={inputStyle} placeholder="Nombre" value={nombre} onChange={e => setNombre(e.target.value)} />
          <input style={inputStyle} placeholder="WhatsApp" type="tel" value={telefono} onChange={e => setTelefono(e.target.value)} />
          <input style={inputStyle} placeholder="Email (opcional)" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
          <button
            onClick={handleSubmit}
            disabled={!formValido || enviando}
            className="w-full py-4 rounded-2xl text-sm font-semibold uppercase tracking-widest transition-all"
            style={{ backgroundColor: formValido ? C.burgundy : C.border, color: "#fff8f5", fontFamily: fSans, letterSpacing: "0.08em", cursor: formValido ? "pointer" : "not-allowed", opacity: enviando ? 0.7 : 1 }}
          >
            {enviando ? "Reservando..." : slotId ? "Reservar esta hora" : "Elige una hora arriba"}
          </button>
        </div>
      </div>
    </div>
  );
}
