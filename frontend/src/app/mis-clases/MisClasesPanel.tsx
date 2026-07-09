"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";

const C = {
  burgundy: "#7d2b13", blush: "#ffdbd1", cream: "#fff8f5", bg: "#f5ede8",
  brown: "#56423d", dark: "#25190f", muted: "#89726c", border: "#dcc1b9",
};
const fSerif = "var(--font-playfair), 'Playfair Display', Georgia, serif";
const fSans = "var(--font-montserrat), 'Montserrat', sans-serif";
const DISC: Record<string, string> = { "barre-fit": "Barre Fit", "pilates-mat": "Pilates Mat" };
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

type Bono = { id: string; disciplina_id: string; nombre: string; creditos_restantes: number; creditos_totales: number; caduca: string; estado: string };
type Clase = { orario_id: string; disciplina_id: string; fecha: string; dia: string; hora: string; horaFin: string; libres: number; tope: number; reserva_id: string | null };

const hoyStr = () => new Date().toISOString().slice(0, 10);
const fechaLabel = (fecha: string, dia: string) => {
  const [, m, d] = fecha.split("-");
  return `${dia} ${+d} de ${MESES[+m - 1]}`;
};
const caducaLabel = (f: string) => { const [y, m, d] = f.split("-"); return `${+d}/${+m}/${y.slice(2)}`; };

export default function MisClasesPanel() {
  const params = useSearchParams();
  const [estado, setEstado] = useState<"cargando" | "login" | "panel">("cargando");
  const [email, setEmail] = useState("");
  const [bonos, setBonos] = useState<Bono[]>([]);
  const [clases, setClases] = useState<Clase[]>([]);
  const [enviado, setEnviado] = useState(false);
  const [msg, setMsg] = useState("");
  const [accion, setAccion] = useState(false);
  const iniciado = useRef(false);

  const cargarCalendario = useCallback(async () => {
    const res = await fetch("/api/panel/calendario", { cache: "no-store" });
    if (res.status === 401) { setEstado("login"); return; }
    const data = await res.json();
    setBonos(data.bonos ?? []);
    setClases(data.clases ?? []);
    setEstado("panel");
  }, []);

  // Al abrir: si viene ?acceso=token, verifica y limpia la URL; si no, intenta cargar.
  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;
    const token = params.get("acceso");
    (async () => {
      if (token) {
        const res = await fetch("/api/panel/verificar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
        window.history.replaceState({}, "", "/mis-clases");
        if (!res.ok) { setEstado("login"); setMsg("El enlace no es válido o ha caducado. Pídelo de nuevo."); return; }
      }
      await cargarCalendario();
    })();
  }, [params, cargarCalendario]);

  // Refresco periódico del calendario (near-real-time) mientras estás en el panel.
  useEffect(() => {
    if (estado !== "panel") return;
    const t = setInterval(() => { cargarCalendario(); }, 20000);
    return () => clearInterval(t);
  }, [estado, cargarCalendario]);

  const pedirAcceso = async () => {
    if (!/\S+@\S+\.\S+/.test(email.trim())) { setMsg("Escribe un email válido."); return; }
    setAccion(true); setMsg("");
    try {
      await fetch("/api/panel/solicitar-acceso", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim() }) });
      setEnviado(true);
    } finally { setAccion(false); }
  };

  const bonoUsable = (disciplinaId: string) =>
    bonos.find(b => b.disciplina_id === disciplinaId && b.creditos_restantes > 0 && b.caduca >= hoyStr());

  const reservar = async (c: Clase) => {
    const bono = bonoUsable(c.disciplina_id);
    if (!bono || accion) return;
    setAccion(true); setMsg("");
    try {
      const res = await fetch("/api/panel/reservar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bono_id: bono.id, orario_id: c.orario_id, fecha: c.fecha }) });
      const data = await res.json();
      if (!res.ok) setMsg(data.error || "No se pudo reservar.");
      await cargarCalendario();
    } finally { setAccion(false); }
  };

  const cancelar = async (c: Clase) => {
    if (!c.reserva_id || accion) return;
    setAccion(true); setMsg("");
    try {
      const res = await fetch("/api/panel/cancelar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reserva_id: c.reserva_id }) });
      const data = await res.json();
      if (!res.ok) setMsg(data.error || "No se pudo cancelar.");
      await cargarCalendario();
    } finally { setAccion(false); }
  };

  const salir = async () => { await fetch("/api/panel/salir", { method: "POST" }); window.location.reload(); };

  // ── Vistas ──
  if (estado === "cargando") {
    return <div style={{ minHeight: "100vh", backgroundColor: C.bg }} className="flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: C.burgundy, borderTopColor: "transparent" }} /></div>;
  }

  if (estado === "login") {
    return (
      <div style={{ backgroundColor: C.bg, minHeight: "100vh" }} className="flex items-center justify-center px-4 py-12">
        <div className="max-w-sm w-full rounded-3xl p-7 shadow-sm" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}` }}>
          <h1 className="text-2xl mb-1" style={{ fontFamily: fSerif, color: C.burgundy }}>Tus clases</h1>
          <p className="text-sm mb-5" style={{ color: C.muted }}>Entra con el correo con el que compraste tu bono. Te enviamos un enlace de acceso.</p>
          {enviado ? (
            <div className="rounded-2xl p-4 text-sm" style={{ backgroundColor: C.blush, color: C.burgundy }}>📩 Si ese correo tiene un bono, te hemos enviado un enlace de acceso. Revisa tu email (y el spam).</div>
          ) : (
            <>
              <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === "Enter") pedirAcceso(); }} placeholder="Tu email" type="email"
                style={{ border: `1.5px solid ${C.border}`, borderRadius: "12px", padding: "12px 16px", fontSize: "16px", color: C.dark, backgroundColor: C.cream, outline: "none", width: "100%" }} />
              {msg && <p className="text-sm mt-2" style={{ color: "#b71c1c" }}>{msg}</p>}
              <button onClick={pedirAcceso} disabled={accion} className="w-full mt-3 py-3.5 rounded-2xl text-sm font-semibold uppercase tracking-widest" style={{ backgroundColor: C.burgundy, color: C.cream, fontFamily: fSans, letterSpacing: "0.08em", opacity: accion ? 0.7 : 1 }}>
                {accion ? "Enviando..." : "Enviarme el enlace"}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Panel
  const usables = bonos.filter(b => b.creditos_restantes > 0 && b.caduca >= hoyStr());
  const porFecha: Record<string, Clase[]> = {};
  for (const c of clases) (porFecha[c.fecha] ??= []).push(c);
  const fechas = Object.keys(porFecha).sort();

  return (
    <div style={{ backgroundColor: C.bg, minHeight: "100vh" }} className="px-4 py-8">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-3xl" style={{ fontFamily: fSerif, color: C.burgundy }}>Tus clases</h1>
          <button onClick={salir} className="text-xs" style={{ color: C.muted }}>Salir</button>
        </div>

        {/* Bonos */}
        <div className="flex flex-col gap-2 mb-6 mt-3">
          {usables.length === 0 && <p className="text-sm" style={{ color: C.muted }}>No tienes bonos con créditos. <a href="/comprar-bono" style={{ color: C.burgundy, fontWeight: 600 }}>Comprar un bono →</a></p>}
          {usables.map(b => (
            <div key={b.id} className="rounded-2xl px-4 py-3 flex items-center justify-between" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}` }}>
              <div>
                <p className="text-sm font-bold" style={{ color: C.dark, fontFamily: fSans }}>{DISC[b.disciplina_id] ?? b.disciplina_id}</p>
                <p className="text-xs" style={{ color: C.muted }}>caduca {caducaLabel(b.caduca)}</p>
              </div>
              <p className="text-sm font-bold" style={{ color: C.burgundy }}>🎟️ {b.creditos_restantes} {b.creditos_restantes === 1 ? "crédito" : "créditos"}</p>
            </div>
          ))}
        </div>

        {msg && <p className="text-sm mb-3 text-center" style={{ color: "#b71c1c" }}>{msg}</p>}

        {/* Calendario */}
        {fechas.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: C.muted }}>No hay clases disponibles ahora mismo.</p>
        ) : fechas.map(fecha => (
          <div key={fecha} className="mb-5">
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: C.burgundy }}>{fechaLabel(fecha, porFecha[fecha][0].dia)}</p>
            <div className="flex flex-col gap-2">
              {porFecha[fecha].map(c => {
                const reservada = !!c.reserva_id;
                const puede = !!bonoUsable(c.disciplina_id);
                const lleno = c.libres <= 0;
                return (
                  <div key={c.orario_id + c.fecha} className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3" style={{ backgroundColor: reservada ? C.blush : "#fff", border: `1px solid ${reservada ? C.burgundy : C.border}` }}>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" style={{ color: C.dark, fontFamily: fSans }}>{c.hora}–{c.horaFin} · {DISC[c.disciplina_id] ?? c.disciplina_id}</p>
                      <p className="text-xs" style={{ color: lleno && !reservada ? "#b71c1c" : "#1f7a3d" }}>{reservada ? "Reservada ✓" : lleno ? "Completa" : `${c.libres} libres`}</p>
                    </div>
                    {reservada ? (
                      <button onClick={() => cancelar(c)} disabled={accion} className="px-3 py-1.5 rounded-full text-xs font-semibold shrink-0" style={{ backgroundColor: "#fde7e7", color: "#b71c1c" }}>Cancelar</button>
                    ) : puede && !lleno ? (
                      <button onClick={() => reservar(c)} disabled={accion} className="px-4 py-1.5 rounded-full text-xs font-semibold shrink-0" style={{ backgroundColor: C.burgundy, color: C.cream }}>Reservar</button>
                    ) : (
                      <span className="text-xs shrink-0" style={{ color: C.muted }}>{lleno ? "—" : "Sin crédito"}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
