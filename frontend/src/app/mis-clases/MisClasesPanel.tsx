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
const MESCORTO = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const DIACORTO = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

type Bono = { id: string; disciplina_id: string; nombre: string; creditos_restantes: number; creditos_totales: number; caduca: string; estado: string };
type Clase = { orario_id: string; disciplina_id: string; fecha: string; dia: string; hora: string; horaFin: string; libres: number; tope: number; reserva_id: string | null };

const pad2 = (n: number) => String(n).padStart(2, "0");
const fStr = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const lunesDe = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); const dw = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dw); return x; };
const MSW = 7 * 86400000;
const hoyStr = () => fStr(new Date());
const fechaLabel = (fecha: string, dia: string) => { const [, m, d] = fecha.split("-"); return `${dia} ${+d} de ${MESES[+m - 1]}`; };
const caducaLabel = (f: string) => { const [y, m, d] = f.split("-"); return `${+d}/${+m}/${y.slice(2)}`; };

export default function MisClasesPanel() {
  const params = useSearchParams();
  const [estado, setEstado] = useState<"cargando" | "login" | "panel">("cargando");
  const [preview, setPreview] = useState(false);
  const [tab, setTab] = useState<"reservar" | "reservas">("reservar");
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [bonos, setBonos] = useState<Bono[]>([]);
  const [clases, setClases] = useState<Clase[]>([]);
  const [diaSel, setDiaSel] = useState("");
  const [semana, setSemana] = useState(0);
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

  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;
    const prev = params.get("preview");
    const token = params.get("acceso");
    (async () => {
      if (prev && ["barre-fit", "pilates-mat"].includes(prev)) {
        setPreview(true);
        const res = await fetch(`/api/panel/calendario-preview?disciplina=${prev}`, { cache: "no-store" });
        const data = await res.json();
        setClases(data.clases ?? []);
        setEstado("panel");
        return;
      }
      if (token) {
        const res = await fetch("/api/panel/verificar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
        window.history.replaceState({}, "", "/mis-clases");
        if (!res.ok) { setEstado("login"); setMsg("El enlace no es válido. Entra con tu correo y tu nombre."); return; }
      }
      await cargarCalendario();
    })();
  }, [params, cargarCalendario]);

  useEffect(() => {
    if (!clases.length) return;
    const primera = [...new Set(clases.map(c => c.fecha))].sort()[0];
    setDiaSel(primera);
    setSemana(Math.max(0, Math.floor((new Date(primera + "T00:00").getTime() - lunesDe(new Date()).getTime()) / MSW)));
  }, [clases]);

  useEffect(() => {
    if (estado !== "panel" || preview) return;
    const t = setInterval(() => { cargarCalendario(); }, 20000);
    return () => clearInterval(t);
  }, [estado, preview, cargarCalendario]);

  const entrar = async () => {
    if (!/\S+@\S+\.\S+/.test(email.trim())) { setMsg("Escribe un email válido."); return; }
    if (!nombre.trim()) { setMsg("Escribe tu nombre."); return; }
    setAccion(true); setMsg("");
    try {
      const res = await fetch("/api/panel/entrar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), nombre: nombre.trim() }) });
      const data = await res.json();
      if (!res.ok) { setMsg(data.error || "No se pudo entrar."); return; }
      await cargarCalendario();
    } finally { setAccion(false); }
  };

  const bonoUsable = (disciplinaId: string) => bonos.find(b => b.disciplina_id === disciplinaId && b.creditos_restantes > 0 && b.caduca >= hoyStr());

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
      if (!res.ok) setMsg(data.error || "No se pudo eliminar.");
      await cargarCalendario();
    } finally { setAccion(false); }
  };

  const salir = async () => { await fetch("/api/panel/salir", { method: "POST" }); window.location.reload(); };

  if (estado === "cargando") {
    return <div style={{ minHeight: "100vh", backgroundColor: C.bg }} className="flex items-center justify-center"><div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: C.burgundy, borderTopColor: "transparent" }} /></div>;
  }

  if (estado === "login") {
    const inputStyle = { border: `1.5px solid ${C.border}`, borderRadius: "12px", padding: "12px 16px", fontSize: "16px", color: C.dark, backgroundColor: C.cream, outline: "none", width: "100%" };
    return (
      <div style={{ backgroundColor: C.bg, minHeight: "100vh" }} className="flex items-center justify-center px-4 py-12">
        <div className="max-w-sm w-full rounded-3xl p-7 shadow-sm" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}` }}>
          <h1 className="text-2xl mb-1" style={{ fontFamily: fSerif, color: C.burgundy }}>Mis clases</h1>
          <p className="text-sm mb-5" style={{ color: C.muted }}>Entra con el <strong>nombre</strong> y el <strong>correo</strong> con los que compraste tu bono.</p>
          <div className="space-y-3">
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Tu nombre y apellidos" style={inputStyle} />
            <input value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === "Enter") entrar(); }} placeholder="Tu email" type="email" style={inputStyle} />
          </div>
          {msg && <p className="text-sm mt-2" style={{ color: "#b71c1c" }}>{msg}</p>}
          <button onClick={entrar} disabled={accion} className="w-full mt-3 py-3.5 rounded-2xl text-sm font-semibold uppercase tracking-widest" style={{ backgroundColor: C.burgundy, color: C.cream, fontFamily: fSans, letterSpacing: "0.08em", opacity: accion ? 0.7 : 1 }}>
            {accion ? "Entrando..." : "Entrar"}
          </button>
          <p className="text-xs mt-4 text-center" style={{ color: C.muted }}>¿Aún no tienes bono? <a href="/comprar-bono" style={{ color: C.burgundy, fontWeight: 600 }}>Comprar uno →</a></p>
        </div>
      </div>
    );
  }

  // ── Panel ──
  const usables = bonos.filter(b => b.creditos_restantes > 0 && b.caduca >= hoyStr());
  const porFecha: Record<string, Clase[]> = {};
  for (const c of clases) (porFecha[c.fecha] ??= []).push(c);
  const fechas = Object.keys(porFecha).sort();
  const misReservas = clases.filter(c => c.reserva_id).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));

  const lunesBase = lunesDe(new Date());
  const lunesSem = new Date(lunesBase); lunesSem.setDate(lunesBase.getDate() + semana * 7);
  const dias7 = Array.from({ length: 7 }, (_, k) => { const d = new Date(lunesSem); d.setDate(lunesSem.getDate() + k); return { fecha: fStr(d), corto: DIACORTO[k], num: d.getDate() }; });
  const finSem = new Date(lunesSem); finSem.setDate(lunesSem.getDate() + 6);
  const maxFecha = fechas.length ? fechas[fechas.length - 1] : fStr(lunesBase);
  const maxSemana = Math.max(0, Math.floor((new Date(maxFecha + "T00:00").getTime() - lunesBase.getTime()) / MSW));
  const rango = `${lunesSem.getDate()} ${MESCORTO[lunesSem.getMonth()]} – ${finSem.getDate()} ${MESCORTO[finSem.getMonth()]}`;
  const delDia = diaSel ? (porFecha[diaSel] ?? []) : [];

  const cambiarSemana = (delta: number) => {
    const nueva = Math.max(0, Math.min(maxSemana, semana + delta));
    setSemana(nueva);
    const ls = new Date(lunesBase); ls.setDate(lunesBase.getDate() + nueva * 7);
    const dsem = Array.from({ length: 7 }, (_, k) => { const d = new Date(ls); d.setDate(ls.getDate() + k); return fStr(d); });
    setDiaSel(dsem.find(f => porFecha[f]) ?? "");
  };

  const calendario = (
    fechas.length === 0 ? (
      <p className="text-sm text-center py-8" style={{ color: C.muted }}>No hay clases disponibles ahora mismo.</p>
    ) : (
      <>
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => cambiarSemana(-1)} disabled={semana <= 0} className="w-9 h-9 rounded-full flex items-center justify-center text-xl leading-none" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}`, color: C.burgundy, opacity: semana <= 0 ? 0.3 : 1 }}>‹</button>
          <p className="text-sm font-bold" style={{ color: C.burgundy, fontFamily: fSans }}>{rango}</p>
          <button onClick={() => cambiarSemana(1)} disabled={semana >= maxSemana} className="w-9 h-9 rounded-full flex items-center justify-center text-xl leading-none" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}`, color: C.burgundy, opacity: semana >= maxSemana ? 0.3 : 1 }}>›</button>
        </div>
        <div className="grid grid-cols-7 gap-1.5 mb-4">
          {dias7.map(dd => {
            const tiene = !!porFecha[dd.fecha];
            const activo = dd.fecha === diaSel;
            return (
              <button key={dd.fecha} onClick={() => tiene && setDiaSel(dd.fecha)} disabled={!tiene} className="rounded-xl py-2 text-center transition-all"
                style={{ backgroundColor: activo ? C.burgundy : "#fff", border: `1.5px solid ${activo ? C.burgundy : C.border}`, opacity: tiene ? 1 : 0.4, cursor: tiene ? "pointer" : "default" }}>
                <p className="text-[9px] font-bold uppercase" style={{ color: activo ? C.blush : C.muted }}>{dd.corto}</p>
                <p className="text-sm font-bold leading-tight" style={{ color: activo ? C.cream : C.dark }}>{dd.num}</p>
                <div className="h-1.5 flex justify-center items-center">{tiene && !activo && <span className="w-1 h-1 rounded-full" style={{ backgroundColor: C.burgundy }} />}</div>
              </button>
            );
          })}
        </div>
        {delDia.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: C.muted }}>Ningún día de esta semana tiene clase. Usa ‹ › para ver otras semanas.</p>
        ) : (
          <>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: C.burgundy }}>{fechaLabel(diaSel, delDia[0].dia)}</p>
            <div className="flex flex-col gap-2">
              {delDia.map(c => {
                const reservada = !!c.reserva_id;
                const puede = !preview && !!bonoUsable(c.disciplina_id);
                const lleno = c.libres <= 0;
                return (
                  <div key={c.orario_id + c.fecha} className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3" style={{ backgroundColor: reservada ? C.blush : "#fff", border: `1px solid ${reservada ? C.burgundy : C.border}` }}>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold" style={{ color: C.dark, fontFamily: fSans }}>{c.hora}–{c.horaFin} · {DISC[c.disciplina_id] ?? c.disciplina_id}</p>
                      <p className="text-xs" style={{ color: lleno && !reservada ? "#b71c1c" : "#1f7a3d" }}>{reservada ? "Reservada ✓" : lleno ? "Completa" : `${c.libres} libres`}</p>
                    </div>
                    {preview ? (
                      <span className="text-xs shrink-0" style={{ color: C.muted }}>{lleno ? "Completa" : `${c.libres} libres`}</span>
                    ) : reservada ? (
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
          </>
        )}
      </>
    )
  );

  return (
    <div style={{ backgroundColor: C.bg, minHeight: "100vh" }} className="px-4 py-8">
      <div className="max-w-md mx-auto">
        {preview && (
          <div className="rounded-2xl px-4 py-2.5 mb-4 text-xs font-semibold text-center" style={{ backgroundColor: C.burgundy, color: C.cream }}>
            👁️ Vista previa — así lo ven tus alumnas (solo tú la ves)
          </div>
        )}

        <div className="flex items-center justify-between mb-3">
          <h1 className="text-3xl" style={{ fontFamily: fSerif, color: C.burgundy }}>Mis clases</h1>
          {!preview && <button onClick={salir} className="text-xs" style={{ color: C.muted }}>Salir</button>}
        </div>

        {!preview && (
          <div className="flex flex-col gap-2 mb-4">
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
        )}

        {!preview && (
          <div className="flex gap-1 mb-4 p-1 rounded-full" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}` }}>
            {([["reservar", "Reservar"], ["reservas", "Mis reservas"]] as const).map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)} className="flex-1 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all" style={{ backgroundColor: tab === t ? C.burgundy : "transparent", color: tab === t ? C.cream : C.muted }}>
                {label}{t === "reservas" && misReservas.length > 0 ? ` (${misReservas.length})` : ""}
              </button>
            ))}
          </div>
        )}

        {msg && <p className="text-sm mb-3 text-center" style={{ color: "#b71c1c" }}>{msg}</p>}

        {preview || tab === "reservar" ? calendario : (
          misReservas.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: C.muted }}>No tienes clases reservadas. Ve a <strong style={{ color: C.burgundy }}>Reservar</strong> para elegir un día.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {misReservas.map(c => (
                <div key={c.orario_id + c.fecha} className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3" style={{ backgroundColor: C.blush, border: `1px solid ${C.burgundy}` }}>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color: C.dark, fontFamily: fSans }}>{fechaLabel(c.fecha, c.dia)}</p>
                    <p className="text-xs" style={{ color: C.muted }}>{c.hora}–{c.horaFin} · {DISC[c.disciplina_id] ?? c.disciplina_id}</p>
                  </div>
                  <button onClick={() => cancelar(c)} disabled={accion} className="px-3 py-1.5 rounded-full text-xs font-semibold shrink-0" style={{ backgroundColor: "#fde7e7", color: "#b71c1c" }}>Eliminar</button>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
