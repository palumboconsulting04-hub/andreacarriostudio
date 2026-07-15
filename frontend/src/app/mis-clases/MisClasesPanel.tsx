"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { fetchBonos, type BonoTipo } from "@/lib/queries";
import CompartirCodigo from "@/components/CompartirCodigo";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

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

type Bono = { id: string; disciplina_id: string; nombre: string; creditos_restantes: number; creditos_totales: number; caduca: string; valido_desde: string | null; estado: string };
type Clase = { orario_id: string; disciplina_id: string; fecha: string; dia: string; hora: string; horaFin: string; libres: number; tope: number; reserva_id: string | null };
type Mensual = { iscrizione_id: string; orario_id: string; disciplina_id: string; fecha: string; dia: string; hora: string; horaFin: string; avisado: boolean; motivo: string | null };

const pad2 = (n: number) => String(n).padStart(2, "0");
const fStr = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const lunesDe = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); const dw = (x.getDay() + 6) % 7; x.setDate(x.getDate() - dw); return x; };
const MSW = 7 * 86400000;
const hoyStr = () => fStr(new Date());
const fechaLabel = (fecha: string, dia: string) => { const [, m, d] = fecha.split("-"); return `${dia} ${+d} de ${MESES[+m - 1]}`; };
const caducaLabel = (f: string) => { const [y, m, d] = f.split("-"); return `${+d}/${+m}/${y.slice(2)}`; };
const inicioLabel = (f: string) => new Date(`${f}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long" });
const primerDeMes = (fecha: string) => { const [y, m] = fecha.split("-"); return new Date(+y, +m - 1, 1); };
const INI_DIA = ["L", "M", "X", "J", "V", "S", "D"];

// Vista de mes: cuadrícula del mes con un puntito en los días que tienen clase.
// La comparten los dos calendarios (bono y mensualidad); cada uno pinta debajo
// las clases del día que se toque.
function MesGrid({ mesCur, irMes, minMes, maxMes, hayClase, diaSel, onDia, onSemana, selBg, selText, selBorder }: {
  mesCur: Date; irMes: (d: Date) => void; minMes: Date; maxMes: Date;
  hayClase: (f: string) => boolean; diaSel: string; onDia: (f: string) => void; onSemana: () => void;
  selBg: string; selText: string; selBorder: string;
}) {
  const y = mesCur.getFullYear(), mo = mesCur.getMonth();
  const offset = (new Date(y, mo, 1).getDay() + 6) % 7; // lunes = 0
  const nDias = new Date(y, mo + 1, 0).getDate();
  const celdas: (string | null)[] = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let d = 1; d <= nDias; d++) celdas.push(fStr(new Date(y, mo, d)));
  while (celdas.length % 7 !== 0) celdas.push(null);
  const puedePrev = new Date(y, mo, 1) > minMes;
  const puedeNext = new Date(y, mo, 1) < maxMes;
  const arrow = "w-9 h-9 rounded-full flex items-center justify-center text-xl leading-none";
  return (
    <>
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => puedePrev && irMes(new Date(y, mo - 1, 1))} disabled={!puedePrev} className={arrow} style={{ backgroundColor: "#fff", border: `1px solid ${C.border}`, color: C.burgundy, opacity: puedePrev ? 1 : 0.3 }}>‹</button>
        <p className="flex-1 text-center text-sm font-bold capitalize" style={{ color: C.burgundy, fontFamily: fSans }}>{MESES[mo]} {y}</p>
        <button onClick={() => puedeNext && irMes(new Date(y, mo + 1, 1))} disabled={!puedeNext} className={arrow} style={{ backgroundColor: "#fff", border: `1px solid ${C.border}`, color: C.burgundy, opacity: puedeNext ? 1 : 0.3 }}>›</button>
        <button onClick={onSemana} className="px-3 h-9 rounded-full text-xs font-semibold shrink-0" style={{ backgroundColor: C.blush, color: C.burgundy, border: `1px solid ${C.border}` }}>Semana</button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {INI_DIA.map((d, i) => <p key={i} className="text-[10px] font-bold text-center" style={{ color: C.muted }}>{d}</p>)}
      </div>
      <div className="grid grid-cols-7 gap-1 mb-4">
        {celdas.map((f, i) => {
          if (!f) return <div key={i} />;
          const tiene = hayClase(f);
          const activo = f === diaSel;
          return (
            <button key={i} onClick={() => tiene && onDia(f)} disabled={!tiene} className="aspect-square rounded-lg flex flex-col items-center justify-center"
              style={{ backgroundColor: activo ? selBg : (tiene ? "#fff" : "transparent"), border: `1.5px solid ${tiene ? (activo ? selBorder : C.border) : "transparent"}`, cursor: tiene ? "pointer" : "default" }}>
              <span className="text-xs font-bold leading-none" style={{ color: activo ? selText : C.dark, opacity: tiene ? 1 : 0.4 }}>{+f.slice(8)}</span>
              <span className="mt-0.5 h-1 flex items-center justify-center">{tiene && !activo && <span className="w-1 h-1 rounded-full" style={{ backgroundColor: C.burgundy }} />}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

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
  const [diaSelM, setDiaSelM] = useState("");
  const [semanaM, setSemanaM] = useState(0);
  const [vistaMes, setVistaMes] = useState(false);
  const [mesCur, setMesCur] = useState<Date | null>(null);
  const [vistaMesM, setVistaMesM] = useState(false);
  const [mesCurM, setMesCurM] = useState<Date | null>(null);
  const [diaMesM, setDiaMesM] = useState("");
  const [msg, setMsg] = useState("");
  const [accion, setAccion] = useState(false);
  const [confirmar, setConfirmar] = useState<Clase | null>(null);
  const [codigo, setCodigo] = useState("");
  const [refAmigas, setRefAmigas] = useState(0);
  const [refPremios, setRefPremios] = useState<{ detalle: string }[]>([]);
  const [mensualidad, setMensualidad] = useState<Mensual[]>([]);
  const [avisando, setAvisando] = useState<string | null>(null);
  const iniciado = useRef(false);
  const semanaMInit = useRef(false);

  // Al cargar la mensualidad, abre el calendario en la primera semana con el horario
  // completo (la 1ª semana del curso puede ser parcial porque arranca en martes).
  useEffect(() => {
    if (!mensualidad.length || semanaMInit.current) return;
    semanaMInit.current = true;
    const fechas = mensualidad.map(m => m.fecha).sort();
    const base = lunesDe(new Date(fechas[0] + "T00:00"));
    const cnt: Record<number, number> = {};
    for (const f of fechas) { const w = Math.round((lunesDe(new Date(f + "T00:00")).getTime() - base.getTime()) / MSW); cnt[w] = (cnt[w] ?? 0) + 1; }
    const max = Math.max(...Object.values(cnt));
    const full = Math.min(...Object.keys(cnt).map(Number).filter(w => cnt[w] === max));
    if (full > 0) setSemanaM(full);
  }, [mensualidad]);

  const cargarCalendario = useCallback(async () => {
    const res = await fetch("/api/panel/calendario", { cache: "no-store" });
    if (res.status === 401) { setEstado("login"); return; }
    const data = await res.json();
    setBonos(data.bonos ?? []);
    setClases(data.clases ?? []);
    setCodigo(data.codigo ?? "");
    setRefAmigas(data.totalAmigas ?? 0);
    setRefPremios(data.premios ?? []);
    setMensualidad(data.mensualidad ?? []);
    setEstado("panel");
  }, []);


  useEffect(() => {
    if (iniciado.current) return;
    iniciado.current = true;
    const prev = params.get("preview");
    const token = params.get("acceso");
    const emailParam = params.get("email");
    const forzarLogin = params.get("entrar"); // desde el email o la página de gracias
    if (emailParam) setEmail(emailParam); // pre-rellena el correo tras la compra
    (async () => {
      if (prev && ["barre-fit", "pilates-mat"].includes(prev)) {
        setPreview(true);
        const res = await fetch(`/api/panel/calendario-preview?disciplina=${prev}`, { cache: "no-store" });
        const data = await res.json();
        setClases(data.clases ?? []);
        setEstado("panel");
        return;
      }
      // Enlaces del email / página de gracias: SIEMPRE al login. Limpiamos cualquier
      // sesión previa para no entrar por error en el panel de otra persona.
      if (forzarLogin) {
        await fetch("/api/panel/salir", { method: "POST" }).catch(() => {});
        window.history.replaceState({}, "", "/mis-clases");
        setEstado("login");
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

  const bonoUsable = (disciplinaId: string) => bonos.find(b => b.disciplina_id === disciplinaId && b.creditos_restantes > 0 && b.caduca >= hoyStr() && (!b.valido_desde || b.valido_desde <= hoyStr()));

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

  const avisarAusencia = async (m: Mensual, cancelar: boolean) => {
    if (avisando) return;
    let motivo: string | null = null;
    if (!cancelar) {
      const r = window.prompt("Si quieres, dinos por qué no puedes ir (opcional). Puedes dejarlo vacío y darle a Aceptar.");
      if (r === null) return; // canceló el aviso
      motivo = r.trim() || null;
    }
    const key = `${m.iscrizione_id}|${m.orario_id}|${m.fecha}`;
    setAvisando(key); setMsg("");
    try {
      const res = await fetch("/api/panel/avisar-ausencia", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iscrizione_id: m.iscrizione_id, orario_id: m.orario_id, fecha: m.fecha, motivo, cancelar }),
      });
      const d = await res.json();
      if (!res.ok) setMsg(d.error || "No se pudo avisar.");
      else await cargarCalendario();
    } catch { setMsg("No se pudo conectar. Inténtalo de nuevo."); }
    finally { setAvisando(null); }
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

  // Comprar más créditos sin salir de la página (Embedded Checkout en modal).
  const [comprarOpen, setComprarOpen] = useState(false);
  const [catalogo, setCatalogo] = useState<BonoTipo[]>([]);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [cargandoPago, setCargandoPago] = useState(false);

  const abrirComprar = async () => {
    setComprarOpen(true); setClientSecret(null); setSessionId(null); setCatalogo([]);
    const disc = bonos[0]?.disciplina_id;
    if (disc) { try { setCatalogo(await fetchBonos(disc)); } catch { setCatalogo([]); } }
  };
  const cerrarComprar = () => { setComprarOpen(false); setClientSecret(null); setSessionId(null); };

  const elegirParaComprar = async (bt: BonoTipo) => {
    setCargandoPago(true);
    try {
      const res = await fetch("/api/panel/comprar-embedded", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bono_tipo_id: bt.id }) });
      const data = await res.json();
      if (data.client_secret) { setClientSecret(data.client_secret); setSessionId(data.session_id); }
    } finally { setCargandoPago(false); }
  };

  const pagoCompletado = useCallback(async () => {
    if (sessionId) await fetch("/api/confirm-bono", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ session_id: sessionId }) }).catch(() => {});
    await cargarCalendario();
    setComprarOpen(false); setClientSecret(null); setSessionId(null);
  }, [sessionId, cargarCalendario]);

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
  const usables = bonos.filter(b => b.creditos_restantes > 0 && b.caduca >= hoyStr() && (!b.valido_desde || b.valido_desde <= hoyStr()));
  const porEmpezar = bonos.filter(b => b.creditos_restantes > 0 && b.caduca >= hoyStr() && !!b.valido_desde && b.valido_desde > hoyStr());
  const porFecha: Record<string, Clase[]> = {};
  for (const c of clases) (porFecha[c.fecha] ??= []).push(c);
  const fechas = Object.keys(porFecha).sort();
  const misReservas = clases.filter(c => c.reserva_id).sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  const waAndrea = `https://wa.me/34614679291?text=${encodeURIComponent("¡Hola Andrea! Tengo una duda sobre mis clases.")}`;

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

  // Vista de mes del calendario de bono.
  const minMesB = fechas.length ? primerDeMes(fechas[0]) : primerDeMes(hoyStr());
  const maxMesB = fechas.length ? primerDeMes(fechas[fechas.length - 1]) : minMesB;
  const selDiaMesB = (f: string) => { setDiaSel(f); setSemana(Math.round((lunesDe(new Date(f + "T00:00")).getTime() - lunesBase.getTime()) / MSW)); };
  const irMesB = (nuevo: Date) => {
    setMesCur(nuevo);
    const primera = fechas.find(f => { const d = new Date(f + "T00:00"); return d.getMonth() === nuevo.getMonth() && d.getFullYear() === nuevo.getFullYear(); });
    if (primera) selDiaMesB(primera);
  };
  const abrirMesB = () => {
    const a = diaSel && porFecha[diaSel] ? new Date(diaSel + "T00:00") : lunesSem;
    irMesB(new Date(a.getFullYear(), a.getMonth(), 1));
    setVistaMes(true);
  };

  // ── Calendario de mensualidad: TODAS sus clases fijas de la semana visible ──
  const porFechaM: Record<string, Mensual[]> = {};
  for (const m of mensualidad) (porFechaM[m.fecha] ??= []).push(m);
  const fechasM = Object.keys(porFechaM).sort();
  const lunesBaseM = fechasM.length ? lunesDe(new Date(fechasM[0] + "T00:00")) : lunesDe(new Date());
  const lunesSemM = new Date(lunesBaseM); lunesSemM.setDate(lunesBaseM.getDate() + semanaM * 7);
  const finSemM = new Date(lunesSemM); finSemM.setDate(lunesSemM.getDate() + 6);
  const dias7M = Array.from({ length: 7 }, (_, k) => { const d = new Date(lunesSemM); d.setDate(lunesSemM.getDate() + k); return { fecha: fStr(d), corto: DIACORTO[k], num: d.getDate() }; });
  const maxFechaM = fechasM.length ? fechasM[fechasM.length - 1] : fStr(lunesBaseM);
  const maxSemanaM = Math.max(0, Math.floor((new Date(maxFechaM + "T00:00").getTime() - lunesBaseM.getTime()) / MSW));
  const rangoM = `${lunesSemM.getDate()} ${MESCORTO[lunesSemM.getMonth()]} – ${finSemM.getDate()} ${MESCORTO[finSemM.getMonth()]}`;
  const diaSelMef = diaSelM && porFechaM[diaSelM] ? diaSelM : (dias7M.find(d => porFechaM[d.fecha])?.fecha ?? "");
  const delDiaM = diaSelMef ? (porFechaM[diaSelMef] ?? []) : [];
  const cambiarSemanaM = (delta: number) => {
    const nueva = Math.max(0, Math.min(maxSemanaM, semanaM + delta));
    setSemanaM(nueva);
    const ls = new Date(lunesBaseM); ls.setDate(lunesBaseM.getDate() + nueva * 7);
    const dsem = Array.from({ length: 7 }, (_, k) => { const d = new Date(ls); d.setDate(ls.getDate() + k); return fStr(d); });
    setDiaSelM(dsem.find(f => porFechaM[f]) ?? "");
  };

  // Vista de mes del calendario de mensualidad.
  const minMesM = fechasM.length ? primerDeMes(fechasM[0]) : primerDeMes(hoyStr());
  const maxMesM = fechasM.length ? primerDeMes(fechasM[fechasM.length - 1]) : minMesM;
  const irMesM = (nuevo: Date) => {
    setMesCurM(nuevo);
    const primera = fechasM.find(f => { const d = new Date(f + "T00:00"); return d.getMonth() === nuevo.getMonth() && d.getFullYear() === nuevo.getFullYear(); });
    setDiaMesM(primera ?? "");
  };
  const abrirMesM = () => {
    const a = diaMesM && porFechaM[diaMesM] ? new Date(diaMesM + "T00:00") : lunesSemM;
    irMesM(new Date(a.getFullYear(), a.getMonth(), 1));
    setVistaMesM(true);
  };

  const cardMensual = (m: Mensual) => (
    <div key={`${m.iscrizione_id}|${m.orario_id}|${m.fecha}`} className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3" style={{ backgroundColor: m.avisado ? "#fff" : C.blush, border: `1px solid ${m.avisado ? C.border : C.burgundy}` }}>
      <div className="min-w-0">
        <p className="text-sm font-semibold" style={{ color: m.avisado ? C.muted : C.dark, fontFamily: fSans, textDecoration: m.avisado ? "line-through" : "none" }}>{m.hora}–{m.horaFin} · {DISC[m.disciplina_id] ?? m.disciplina_id}</p>
        <p className="text-xs" style={{ color: m.avisado ? "#b71c1c" : C.muted }}>{m.avisado ? "Avisaste que no vas" : "Tu clase"}</p>
      </div>
      {m.avisado ? (
        <button onClick={() => avisarAusencia(m, true)} disabled={!!avisando} className="px-3 py-1.5 rounded-full text-xs font-semibold shrink-0" style={{ backgroundColor: "#fff", color: C.burgundy, border: `1px solid ${C.burgundy}` }}>Sí que voy</button>
      ) : (
        <button onClick={() => avisarAusencia(m, false)} disabled={!!avisando} className="px-3 py-1.5 rounded-full text-xs font-semibold shrink-0" style={{ backgroundColor: "#fde7e7", color: "#b71c1c" }}>No puedo ir</button>
      )}
    </div>
  );

  const calendarioMensual = (
    <>
      {vistaMesM && mesCurM ? (
        <>
          <MesGrid mesCur={mesCurM} irMes={irMesM} minMes={minMesM} maxMes={maxMesM} hayClase={f => !!porFechaM[f]} diaSel={diaMesM} onDia={setDiaMesM} onSemana={() => setVistaMesM(false)} selBg={C.blush} selText={C.burgundy} selBorder={C.burgundy} />
          {diaMesM && porFechaM[diaMesM]?.length ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: C.burgundy }}>{fechaLabel(diaMesM, porFechaM[diaMesM][0].dia)}</p>
              <div className="flex flex-col gap-2">{porFechaM[diaMesM].map(cardMensual)}</div>
            </div>
          ) : (
            <p className="text-sm text-center py-4" style={{ color: C.muted }}>Toca un día marcado para ver tu clase.</p>
          )}
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => cambiarSemanaM(-1)} disabled={semanaM <= 0} className="w-9 h-9 rounded-full flex items-center justify-center text-xl leading-none" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}`, color: C.burgundy, opacity: semanaM <= 0 ? 0.3 : 1 }}>‹</button>
            <p className="flex-1 text-center text-sm font-bold" style={{ color: C.burgundy, fontFamily: fSans }}>{rangoM}</p>
            <button onClick={() => cambiarSemanaM(1)} disabled={semanaM >= maxSemanaM} className="w-9 h-9 rounded-full flex items-center justify-center text-xl leading-none" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}`, color: C.burgundy, opacity: semanaM >= maxSemanaM ? 0.3 : 1 }}>›</button>
            <button onClick={abrirMesM} className="px-3 h-9 rounded-full text-xs font-semibold shrink-0" style={{ backgroundColor: C.blush, color: C.burgundy, border: `1px solid ${C.border}` }}>Mes</button>
          </div>
          <div className="grid grid-cols-7 gap-1.5 mb-4">
            {dias7M.map(dd => {
              const tiene = !!porFechaM[dd.fecha];
              const activo = dd.fecha === diaSelMef;
              return (
                <button key={dd.fecha} onClick={() => tiene && setDiaSelM(dd.fecha)} disabled={!tiene} className="rounded-xl py-2 text-center transition-all"
                  style={{ backgroundColor: activo ? C.blush : "#fff", border: `1.5px solid ${activo ? C.burgundy : C.border}`, opacity: tiene ? 1 : 0.4, cursor: tiene ? "pointer" : "default" }}>
                  <p className="text-[9px] font-bold uppercase" style={{ color: activo ? C.burgundy : C.muted }}>{dd.corto}</p>
                  <p className="text-sm font-bold leading-tight" style={{ color: activo ? C.burgundy : C.dark }}>{dd.num}</p>
                  <div className="h-1.5 flex justify-center items-center">{tiene && !activo && <span className="w-1 h-1 rounded-full" style={{ backgroundColor: C.burgundy }} />}</div>
                </button>
              );
            })}
          </div>
          {delDiaM.length === 0 ? (
            <p className="text-sm text-center py-6" style={{ color: C.muted }}>Ningún día de esta semana tiene clase. Usa ‹ › o «Mes» para ver otras fechas.</p>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: C.burgundy }}>{fechaLabel(diaSelMef, delDiaM[0].dia)}</p>
              <div className="flex flex-col gap-2">{delDiaM.map(cardMensual)}</div>
            </>
          )}
        </>
      )}
    </>
  );

  const calendario = (
    fechas.length === 0 ? (
      <p className="text-sm text-center py-8" style={{ color: C.muted }}>No hay clases disponibles ahora mismo.</p>
    ) : (
      <>
        {vistaMes && mesCur ? (
          <MesGrid mesCur={mesCur} irMes={irMesB} minMes={minMesB} maxMes={maxMesB} hayClase={f => !!porFecha[f]} diaSel={diaSel} onDia={selDiaMesB} onSemana={() => setVistaMes(false)} selBg={C.burgundy} selText={C.cream} selBorder={C.burgundy} />
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <button onClick={() => cambiarSemana(-1)} disabled={semana <= 0} className="w-9 h-9 rounded-full flex items-center justify-center text-xl leading-none" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}`, color: C.burgundy, opacity: semana <= 0 ? 0.3 : 1 }}>‹</button>
              <p className="flex-1 text-center text-sm font-bold" style={{ color: C.burgundy, fontFamily: fSans }}>{rango}</p>
              <button onClick={() => cambiarSemana(1)} disabled={semana >= maxSemana} className="w-9 h-9 rounded-full flex items-center justify-center text-xl leading-none" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}`, color: C.burgundy, opacity: semana >= maxSemana ? 0.3 : 1 }}>›</button>
              <button onClick={abrirMesB} className="px-3 h-9 rounded-full text-xs font-semibold shrink-0" style={{ backgroundColor: C.blush, color: C.burgundy, border: `1px solid ${C.border}` }}>Mes</button>
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
          </>
        )}
        {delDia.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: C.muted }}>Ningún día de esta semana tiene clase. Usa ‹ › o «Mes» para ver otras fechas.</p>
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
                      <button onClick={() => setConfirmar(c)} disabled={accion} className="px-4 py-1.5 rounded-full text-xs font-semibold shrink-0" style={{ backgroundColor: C.burgundy, color: C.cream }}>Reservar</button>
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
            Vista previa — así lo ven tus alumnas (solo tú la ves)
          </div>
        )}

        <div className="flex items-start justify-between mb-3">
          <div>
            <h1 className="text-3xl" style={{ fontFamily: fSerif, color: C.burgundy }}>Mis clases</h1>
            {!preview && bonos[0]?.nombre && <p className="text-sm font-semibold" style={{ color: C.dark, fontFamily: fSans }}>{bonos[0].nombre}</p>}
          </div>
          {!preview && <button onClick={salir} className="text-xs shrink-0" style={{ color: C.muted }}>Salir</button>}
        </div>

        {!preview && mensualidad.length > 0 && (
          <div className="mb-5">
            <p className="text-sm font-bold mb-1" style={{ color: C.burgundy, fontFamily: fSans }}>Tus clases</p>
            <p className="text-xs mb-3" style={{ color: C.muted }}>No hace falta reservar; estas son tus clases. Si un día no puedes ir, avísanos.</p>
            {calendarioMensual}
          </div>
        )}

        {!preview && (
          <div className="flex flex-col gap-2 mb-4">
            {bonos.length > 0 && usables.length === 0 && porEmpezar.length === 0 && (
              <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: C.blush }}>
                <p className="text-sm font-semibold mb-2" style={{ color: C.burgundy }}>No te quedan créditos</p>
                <button onClick={abrirComprar} className="inline-block px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider" style={{ backgroundColor: C.burgundy, color: C.cream }}>Comprar más créditos →</button>
              </div>
            )}
            {porEmpezar.map(b => (
              <div key={b.id} className="rounded-2xl px-4 py-3 flex items-center justify-between" style={{ backgroundColor: "#fff6f2", border: `1px solid ${C.burgundy}` }}>
                <div>
                  <p className="text-sm font-bold" style={{ color: C.dark, fontFamily: fSans }}>{DISC[b.disciplina_id] ?? b.disciplina_id}</p>
                  <p className="text-xs font-semibold" style={{ color: C.burgundy }}>Empieza el {inicioLabel(b.valido_desde!)}</p>
                </div>
                <p className="text-sm font-bold" style={{ color: C.muted }}>{b.creditos_restantes} {b.creditos_restantes === 1 ? "crédito" : "créditos"}</p>
              </div>
            ))}
            {usables.map(b => (
              <div key={b.id} className="rounded-2xl px-4 py-3 flex items-center justify-between" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}` }}>
                <div>
                  <p className="text-sm font-bold" style={{ color: C.dark, fontFamily: fSans }}>{DISC[b.disciplina_id] ?? b.disciplina_id}</p>
                  <p className="text-xs" style={{ color: C.muted }}>caduca {caducaLabel(b.caduca)}</p>
                </div>
                <p className="text-sm font-bold" style={{ color: C.burgundy }}>{b.creditos_restantes} {b.creditos_restantes === 1 ? "crédito" : "créditos"}</p>
              </div>
            ))}
          </div>
        )}

        {!preview && bonos.length > 0 && (
          <div className="flex gap-1 mb-4 p-1 rounded-full" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}` }}>
            {([["reservar", "Reservar"], ["reservas", "Mis reservas"]] as const).map(([t, label]) => (
              <button key={t} onClick={() => setTab(t)} className="flex-1 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all" style={{ backgroundColor: tab === t ? C.burgundy : "transparent", color: tab === t ? C.cream : C.muted }}>
                {label}{t === "reservas" && misReservas.length > 0 ? ` (${misReservas.length})` : ""}
              </button>
            ))}
          </div>
        )}

        {msg && <p className="text-sm mb-3 text-center" style={{ color: "#b71c1c" }}>{msg}</p>}

        {(preview || bonos.length > 0) && (preview || tab === "reservar" ? calendario : (
          misReservas.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: C.muted }}>No tienes clases reservadas. Ve a <strong style={{ color: C.burgundy }}>Reservar</strong> para elegir un día.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-center mb-1" style={{ color: C.muted }}>Puedes cancelar hasta <strong style={{ color: C.burgundy }}>4 h antes</strong> de la clase y recuperas el crédito.</p>
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
        ))}

        {!preview && (
          <div className="mt-8 pt-5 flex flex-col gap-2" style={{ borderTop: `1px solid ${C.border}` }}>
            <button onClick={abrirComprar} className="w-full text-center py-3 rounded-2xl text-xs font-bold uppercase tracking-wider" style={{ backgroundColor: "#fff", border: `1.5px solid ${C.burgundy}`, color: C.burgundy }}>Comprar más créditos</button>
            <a href={waAndrea} target="_blank" rel="noopener noreferrer" className="w-full text-center py-3 rounded-2xl text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2" style={{ backgroundColor: "#25D366", color: "#fff", textDecoration: "none" }}>¿Dudas? Escríbeme</a>
          </div>
        )}

        {!preview && codigo && (
          <div className="rounded-2xl p-4 mt-8" style={{ backgroundColor: "#fff6f2", border: `1px solid ${C.burgundy}` }}>
            <p className="text-sm font-bold mb-1" style={{ color: C.burgundy, fontFamily: fSans }}>Invita a una amiga y ganáis las dos</p>
            <p className="text-xs mb-3" style={{ color: C.brown }}>Cuando se apunte al estudio (bono o mensualidad), tú y ella os lleváis un regalo. Comparte tu código:</p>
            <span className="block text-center text-sm font-bold tracking-widest py-2.5 rounded-xl mb-3" style={{ backgroundColor: "#fff", border: `1px dashed ${C.burgundy}`, color: C.burgundy }}>{codigo}</span>
            <CompartirCodigo codigo={codigo} />

            {/* Camino a Embajadora: objetivo (5 amigas = mes gratis) y progreso */}
            <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${C.border}` }}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold uppercase tracking-widest" style={{ color: C.burgundy }}>Tu camino a Embajadora 👑</p>
                <span className="text-sm font-bold tabular-nums" style={{ color: C.burgundy }}>{Math.min(refAmigas, 5)}/5</span>
              </div>
              <div className="flex gap-1.5 mb-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <div key={n} className="flex-1 h-2.5 rounded-full transition-all" style={{ backgroundColor: refAmigas >= n ? C.burgundy : C.border }} />
                ))}
              </div>
              <div className="flex justify-between mb-3">
                <span className="text-[10px]" style={{ color: C.muted }}>Cada amiga, un regalo</span>
                <span className="text-[10px] font-bold" style={{ color: refAmigas >= 5 ? C.burgundy : C.muted }}>5 = mes gratis 👑</span>
              </div>
              <p className="text-xs leading-relaxed" style={{ color: C.brown }}>
                {refAmigas >= 5
                  ? <>¡Ya eres <strong style={{ color: C.burgundy }}>Embajadora</strong>! Te has ganado un <strong style={{ color: C.burgundy }}>mes gratis</strong> 👑</>
                  : refAmigas > 0
                    ? <>Llevas <strong style={{ color: C.burgundy }}>{refAmigas}</strong> {refAmigas === 1 ? "amiga" : "amigas"}. Te {5 - refAmigas === 1 ? "falta" : "faltan"} <strong style={{ color: C.burgundy }}>{5 - refAmigas}</strong> para tu <strong>mes gratis</strong>.</>
                    : <>Cuando una amiga se apunta, <strong style={{ color: C.burgundy }}>un regalo</strong> para las dos. Al llegar a <strong style={{ color: C.burgundy }}>5</strong>, un <strong>mes gratis</strong>.</>}
              </p>
              {refPremios.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {refPremios.map((p, i) => (
                    <span key={i} className="text-[11px] px-2.5 py-1 rounded-full" style={{ backgroundColor: "#e8f5e9", color: "#2e7d32" }}>✓ {p.detalle}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {confirmar && (() => {
          const c = confirmar;
          const menos4 = new Date(`${c.fecha}T${c.hora}`).getTime() - Date.now() < 4 * 3600 * 1000;
          return (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ backgroundColor: "rgba(37,25,15,0.55)" }} onClick={() => setConfirmar(null)}>
              <div className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl" style={{ backgroundColor: "#fff" }} onClick={e => e.stopPropagation()}>
                <div className="p-6 text-center">
                  <p className="text-lg font-bold mb-2" style={{ color: C.dark, fontFamily: fSans }}>¿Reservar esta clase?</p>
                  <p className="text-sm font-semibold" style={{ color: C.burgundy, fontFamily: fSans }}>{DISC[c.disciplina_id] ?? c.disciplina_id}</p>
                  <p className="text-sm mb-3" style={{ color: C.brown }}>{fechaLabel(c.fecha, c.dia)} · {c.hora}–{c.horaFin}</p>
                  <p className="text-xs mb-4" style={{ color: C.muted }}>Se usará 1 crédito.</p>
                  {menos4 && (
                    <div className="rounded-2xl px-4 py-3 mb-4 text-xs text-left" style={{ backgroundColor: "#fde7e7", color: "#b71c1c" }}>
                      Es en menos de 4 h: una vez reservada <strong>no podrás cancelarla</strong> ni recuperar el crédito.
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmar(null)} className="flex-1 py-3 rounded-2xl text-sm font-semibold" style={{ border: `1.5px solid ${C.border}`, color: C.brown, backgroundColor: "#fff" }}>Cancelar</button>
                    <button onClick={() => { setConfirmar(null); reservar(c); }} disabled={accion} className="flex-1 py-3 rounded-2xl text-sm font-bold" style={{ backgroundColor: C.burgundy, color: C.cream }}>Reservar</button>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {comprarOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4" style={{ backgroundColor: "rgba(37,25,15,0.55)" }} onClick={cerrarComprar}>
            <div className="w-full max-w-md rounded-3xl overflow-hidden shadow-2xl max-h-[92vh] overflow-y-auto" style={{ backgroundColor: "#fff" }} onClick={e => e.stopPropagation()}>
              <div className="px-5 py-4 flex items-center justify-between" style={{ background: "linear-gradient(135deg,#fff0eb,#fff8f5)" }}>
                <p className="text-lg font-bold" style={{ color: C.dark, fontFamily: fSans }}>Comprar más créditos</p>
                <button onClick={cerrarComprar} className="w-8 h-8 rounded-full flex items-center justify-center text-base leading-none" style={{ backgroundColor: "#fff", border: `1px solid ${C.border}`, color: C.muted }}>✕</button>
              </div>
              <div className="p-5">
                {clientSecret ? (
                  <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret, onComplete: pagoCompletado }}>
                    <EmbeddedCheckout />
                  </EmbeddedCheckoutProvider>
                ) : (
                  <div className="flex flex-col gap-2">
                    {catalogo.length === 0 ? (
                      <p className="text-sm text-center py-6" style={{ color: C.muted }}>Cargando bonos…</p>
                    ) : catalogo.map(bt => (
                      <button key={bt.id} disabled={cargandoPago} onClick={() => elegirParaComprar(bt)} className="rounded-2xl p-4 flex items-center justify-between text-left transition-all" style={{ border: `1.5px solid ${C.border}`, backgroundColor: "#fff", opacity: cargandoPago ? 0.5 : 1 }}>
                        <div className="min-w-0">
                          <p className="text-sm font-bold" style={{ color: C.dark, fontFamily: fSans }}>{bt.nombre}</p>
                          <p className="text-xs" style={{ color: C.muted }}>{bt.creditos === 1 ? "1 clase" : `${bt.creditos} clases`} · {(bt.precio / bt.creditos).toLocaleString("es-ES", { maximumFractionDigits: 1 })}€/clase</p>
                        </div>
                        <p className="text-xl font-bold shrink-0" style={{ color: C.burgundy }}>{bt.precio}€</p>
                      </button>
                    ))}
                    {cargandoPago && <p className="text-xs text-center mt-1" style={{ color: C.muted }}>Preparando el pago seguro…</p>}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
