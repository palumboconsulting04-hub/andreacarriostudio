"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminOrario = {
  id: string;
  giorno: string;
  ora_inizio: string;
  ora_fine: string;
  disciplina_id: string;
  posti_totali: number;
  iscrizione_orari: { iscrizione_id: string }[];
  discipline: { nome: string } | null;
};

type IscrzioneRow = {
  id: string;
  nome: string;
  cognome: string;
  nome_alumna: string | null;
  cognome_alumna: string | null;
  stato: string;
  created_at: string;
  discipline: { nome: string } | null;
  iscrizione_orari: { orari: { giorno: string; ora_inizio: string } | null }[];
};

type OrarioAlumno = {
  iscrizione_id: string;
  iscrizioni: {
    id: string;
    nome: string;
    cognome: string;
    nome_alumna: string | null;
    cognome_alumna: string | null;
    disciplina_id: string;
    stato: string;
  } | null;
};

type KpiStudentRow = {
  id: string;
  nome: string;
  cognome: string;
  nome_alumna: string | null;
  cognome_alumna: string | null;
  disciplina_id: string;
  piano_id: string;
  stato: string;
  created_at: string;
  discipline: { nome: string } | null;
  prezzo: number | null;
};

type OcupacionClase = { id: string; giorno: string; ora_inizio: string; ora_fine: string; ocupados: number; total: number };
type OcupacionDisciplina = { disciplina_id: string; nombre: string; ocupados: number; total: number; clases: OcupacionClase[] };

type IscrizioneDetalle = {
  id: string;
  nome: string;
  cognome: string;
  nome_alumna: string | null;
  cognome_alumna: string | null;
  email: string;
  telefono: string | null;
  stato: string;
  created_at: string;
  disciplina_id: string;
  piano_id: string;
  metodo_pagamento: string;
  discipline: { nome: string } | null;
  iscrizione_orari: { orari: { giorno: string; ora_inizio: string; ora_fine: string } | null }[];
  prezzo?: number | null;
  matricula?: number | null;
  stripe_subscription_id?: string | null;
};

type VentaRow = {
  id: string;
  created_at: string;
  stato: string;
  disciplina_id: string;
  piano_id: string;
  nome: string;
  cognome: string;
  nome_alumna: string | null;
  cognome_alumna: string | null;
  discipline: { nome: string } | null;
  prezzo?: number | null;
  matricula?: number | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DOW_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAYS_SHORT_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const GIORNI = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
const NINAS_IDS = new Set(["pre-ballet", "ballet-i", "ballet-ii"]);
const METODO_LABEL: Record<string, string> = {
  "en-escuela": "En la escuela",
  "tarjeta": "Tarjeta",
  "google-pay": "Google Pay",
  "apple-pay": "Apple Pay",
  "paypal": "PayPal",
};
const PLAN_LABEL: Record<string, string> = {
  "basico": "Básico",
  "avanzado": "Avanzado",
  "intensivo": "Intensivo",
};
// El pago con tarjeta (webhook Stripe) guarda "pagado"; el alta manual guarda "pagato".
// "activa" = suscripción del bono cobrándose cada mes. Los tres cuentan como pago.
const PAID_STATI = new Set(["pagato", "pagado", "activa"]);
const isPaid = (stato: string) => PAID_STATI.has(stato);

// Estados que cuentan como alumna inscrita (incluye "matrícula pagada", cuyo bono
// empieza en septiembre). El bono solo se factura en los estados de PAID_STATI;
// la matrícula se cuenta para cualquier estado de INSCRITA_STATI.
const INSCRITA_STATI_ARR = ["pagato", "pagado", "activa", "matricula_pagada"];

// Etiquetas y colores de cada estado de inscripción.
const STATO_INFO: Record<string, { label: string; bg: string; color: string }> = {
  attesa:           { label: "Pendiente",        bg: "#fde7e7", color: "#b71c1c" },
  pagado:           { label: "Pagado",           bg: "#e8f5e9", color: "#2e7d32" },
  pagato:           { label: "Pagado",           bg: "#e8f5e9", color: "#2e7d32" },
  matricula_pagada: { label: "Matrícula pagada", bg: "#fff3e0", color: "#e65100" },
  activa:           { label: "Bono activo",      bg: "#e8f5e9", color: "#2e7d32" },
  impago:           { label: "Impago",           bg: "#fde7e7", color: "#b71c1c" },
  cancelada:        { label: "Cancelada",        bg: "#eceff1", color: "#546e7a" },
};
const statoInfo = (s: string) => STATO_INFO[s] ?? { label: s, bg: "#eceff1", color: "#546e7a" };
// Estados con suscripción del bono que se puede cancelar.
const SUB_CANCELABLE = new Set(["matricula_pagada", "activa", "impago"]);

// La matrícula se considera pagada en cualquier estado salvo el pendiente de pago.
const matriculaPagada = (stato: string) => stato !== "attesa" && stato !== "cancelada";

// Estado de la cuota mensual (bono) para mostrar en los paneles de alumna.
// "matricula_pagada" = pagó la matrícula pero el bono no empieza a cobrarse hasta septiembre.
function bonoEstado(stato: string): { label: string; bg: string; color: string } {
  switch (stato) {
    case "matricula_pagada": return { label: "Empieza en septiembre", bg: "#fff3e0", color: "#e65100" };
    case "activa":
    case "pagado":
    case "pagato":           return { label: "Cobrándose",            bg: "#e8f5e9", color: "#2e7d32" };
    case "impago":           return { label: "Impago",                bg: "#fde7e7", color: "#b71c1c" };
    case "attesa":           return { label: "Pendiente",             bg: "#fde7e7", color: "#b71c1c" };
    case "cancelada":        return { label: "Cancelado",             bg: "#eceff1", color: "#546e7a" };
    default:                 return { label: "—",                     bg: "#eceff1", color: "#546e7a" };
  }
}

// Enlace a WhatsApp a partir de un teléfono. Si son 9 dígitos (móvil español sin
// prefijo) se antepone el 34; si ya trae prefijo se respeta.
function whatsappHref(telefono: string): string {
  const digits = telefono.replace(/\D/g, "");
  const full = digits.length === 9 ? `34${digits}` : digits;
  return `https://wa.me/${full}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekDates(): Date[] {
  const today = new Date();
  const dow = today.getDay();
  const diff = dow === 0 ? 1 : dow === 6 ? 2 : 1 - dow;
  const mon = new Date(today);
  mon.setDate(today.getDate() + diff);
  return Array.from({ length: 5 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d;
  });
}

function buildGrid(orari: AdminOrario[]): Record<string, Record<string, AdminOrario>> {
  const g: Record<string, Record<string, AdminOrario>> = {};
  for (const o of orari) {
    const t = o.ora_inizio.substring(0, 5);
    if (!g[t]) g[t] = {};
    g[t][o.giorno] = o;
  }
  return g;
}

function getDcClasses(id: string): string {
  if (id === "pilates-mat") return "bg-surface-variant border border-outline-variant";
  if (id === "barre-fit") return "bg-secondary-container/30 border border-secondary-container";
  return "bg-primary-container/20 border border-primary-container/50";
}

function calcAntigüedad(created_at: string): string {
  const start = new Date(created_at);
  const now = new Date();
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (months <= 0) return "Menos de 1 mes";
  if (months === 1) return "1 mes";
  return `${months} meses`;
}

// Formatea los horarios elegidos: "Martes y Jueves · 18:00" si comparten hora,
// o "Mar 18:00 · Jue 19:00" si las horas difieren.
function formatHorarios(orari: { orari: { giorno: string; ora_inizio: string } | null }[]): string {
  const items = (orari ?? [])
    .map((o) => o.orari)
    .filter((o): o is { giorno: string; ora_inizio: string } => !!o)
    .sort((a, b) => {
      const dA = GIORNI.indexOf(a.giorno); const dB = GIORNI.indexOf(b.giorno);
      const oA = dA === -1 ? 99 : dA; const oB = dB === -1 ? 99 : dB;
      if (oA !== oB) return oA - oB;
      return a.ora_inizio.localeCompare(b.ora_inizio);
    });
  if (items.length === 0) return "—";
  const horas = new Set(items.map((i) => i.ora_inizio.substring(0, 5)));
  if (horas.size === 1) {
    return `${items.map((i) => i.giorno).join(" y ")} · ${[...horas][0]}`;
  }
  return items.map((i) => `${i.giorno.substring(0, 3)} ${i.ora_inizio.substring(0, 5)}`).join(" · ");
}

function formatData(created_at: string): string {
  const d = new Date(created_at);
  const today = new Date();
  const ayer = new Date(today);
  ayer.setDate(today.getDate() - 1);
  const time = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `Hoy, ${time}`;
  if (d.toDateString() === ayer.toDateString()) return `Ayer, ${time}`;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" }) + `, ${time}`;
}

function Icon({ name, className = "", style }: { name: string; className?: string; style?: React.CSSProperties }) {
  return <span className={`material-symbols-outlined ${className}`} style={style}>{name}</span>;
}

// Icono ⓘ que, al pulsarlo, muestra una explicación corta de la métrica.
function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex align-middle">
      <span
        role="button"
        tabIndex={0}
        aria-label="Información"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen((o) => !o); }}
        className="inline-flex items-center justify-center cursor-help"
        style={{ color: "#b0a39e" }}
      >
        <Icon name="info" style={{ fontSize: "15px" }} />
      </span>
      {open && (
        <>
          <span className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <span
            onClick={(e) => e.stopPropagation()}
            className="absolute z-50 left-0 top-6 w-52 p-3 rounded-xl text-xs font-normal normal-case tracking-normal leading-snug shadow-lg"
            style={{ backgroundColor: "#25190f", color: "#fff8f5" }}
          >
            {text}
          </span>
        </>
      )}
    </span>
  );
}

// Desglose claro de qué ha pagado la alumna: matrícula (pago único) y cuota mensual (bono).
function PagoResumen({ stato, matricula }: { stato: string; matricula?: number | null }) {
  const mat = matricula ?? 0;
  const matPagada = matriculaPagada(stato);
  const bono = bonoEstado(stato);
  return (
    <div className="px-4 py-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs flex items-center gap-2" style={{ color: "#89726c" }}>
          <Icon name="confirmation_number" className="text-sm" style={{ color: "#7d2b13" }} />
          Matrícula{mat > 0 ? ` · ${mat}€` : ""}
        </span>
        {stato === "cancelada"
          ? <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: "#eceff1", color: "#546e7a" }}>Reembolsada</span>
          : matPagada
            ? <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: "#e8f5e9", color: "#2e7d32" }}>✓ Pagada</span>
            : <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-error-container text-on-error-container">Pendiente</span>}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs flex items-center gap-2" style={{ color: "#89726c" }}>
          <Icon name="event_repeat" className="text-sm" style={{ color: "#7d2b13" }} />
          Cuota mensual (bono)
        </span>
        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: bono.bg, color: bono.color }}>{bono.label}</span>
      </div>
    </div>
  );
}

// Sep=1, Oct=2, Nov=3, Dec=4, Jan=5, Feb=6, Mar=7, Apr=8, May=9, Jun=10, Jul/Aug=1
function getSchoolYearMonth(): number {
  const m = new Date().getMonth();
  if (m >= 8) return m - 7;
  if (m <= 5) return m + 5;
  return 1;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [iscrittiCount, setIscrittiCount] = useState(0);
  const [lezioniCount, setLezioniCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [orari, setOrari] = useState<AdminOrario[]>([]);
  const [bookings, setBookings] = useState<IscrzioneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("Resumen");

  // ── Finanzas state ──
  const [finanzasLoading, setFinanzasLoading] = useState(false);
  const [finanzasMensual, setFinanzasMensual] = useState<{ mes: string; label: string; ingresos: number; costes: number }[]>([]);
  const [finanzasCosteMensual, setFinanzasCosteMensual] = useState(0);

  // ── Eliminar alumno ──
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Nueva inscripción ──
  const [showNuevaInscripcion, setShowNuevaInscripcion] = useState(false);
  const [nif, setNif] = useState({ nome: "", cognome: "", email: "", telefono: "", disciplina_id: "", piano_id: "", metodo_pagamento: "en-escuela", nome_alumna: "", cognome_alumna: "", horarios: [] as string[] });
  const [nifPiani, setNifPiani] = useState<{ id: string; nome: string; prezzo: number }[]>([]);
  const [nifLoading, setNifLoading] = useState(false);

  // ── Nuevo horario ──
  const [showNuevoHorario, setShowNuevoHorario] = useState(false);
  const [nhf, setNhf] = useState({ disciplina_id: "", giorno: "Lunes", ora_inizio: "09:00", ora_fine: "10:00", posti_totali: 10 });
  const [nhfLoading, setNhfLoading] = useState(false);

  // ── Costes state ──
  type CosteRow = { id: string; categoria: string; concepto: string; importe_mensual: number; importe_anual: number; notas: string | null };
  const [costesData, setCostesData] = useState<CosteRow[]>([]);
  const [costesLoading, setCostesLoading] = useState(false);
  const [showCostesDrawer, setShowCostesDrawer] = useState(false);
  const [costesEditId, setCostesEditId] = useState<string | null>(null);
  const [costesEditVals, setCostesEditVals] = useState({ concepto: "", importe_mensual: 0, importe_anual: 0, notas: "" });
  const [costesDeleteId, setCostesDeleteId] = useState<string | null>(null);
  const [showNuevoCosto, setShowNuevoCosto] = useState(false);
  const [nuevoCosto, setNuevoCosto] = useState({ categoria: "Otros", concepto: "", importe_mensual: 0, importe_anual: 0, notas: "" });
  const [addingToCategoria, setAddingToCategoria] = useState<string | null>(null);
  const [inlineNuevo, setInlineNuevo] = useState({ concepto: "", importe_mensual: 0, importe_anual: 0, notas: "" });

  // ── Ventas state ──
  const [ventasData, setVentasData] = useState<VentaRow[]>([]);
  const [ventasMes, setVentasMes] = useState(() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  });
  const [ventasGranularity, setVentasGranularity] = useState<"diario" | "semanal">("semanal");
  const [ventasLoading, setVentasLoading] = useState(false);

  // KPI metrics
  const [facturacionMes, setFacturacionMes] = useState(0);
  const [facturacionMesAnterior, setFacturacionMesAnterior] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [ocupacionMedia, setOcupacionMedia] = useState(0);
  const [ocupacionDisciplinas, setOcupacionDisciplinas] = useState<OcupacionDisciplina[]>([]);
  const [nuevasInscripcionesMes, setNuevasInscripcionesMes] = useState(0);
  const [avgPricePerStudent, setAvgPricePerStudent] = useState(0);

  // Sofia chat
  type SofiaMessage = { role: "user" | "assistant"; content: string };
  const [sofiaMessages, setSofiaMessages] = useState<SofiaMessage[]>([]);
  const [sofiaInput, setSofiaInput] = useState("");
  const [sofiaLoading, setSofiaLoading] = useState(false);

  // ── Usuarios state ──
  const [usuariosData, setUsuariosData] = useState<KpiStudentRow[]>([]);
  const [usuariosLoading, setUsuariosLoading] = useState(false);
  const [usuariosSearch, setUsuariosSearch] = useState("");
  const [usuariosFiltroDisc, setUsuariosFiltroDisc] = useState("");
  const [usuariosFiltroStato, setUsuariosFiltroStato] = useState("");
  const [copiedEmail, setCopiedEmail] = useState(false);
  // Asistencia / pasar lista
  const [asistenciaFecha, setAsistenciaFecha] = useState(() => new Date().toLocaleDateString("en-CA"));
  const [asistenciaOrarioId, setAsistenciaOrarioId] = useState<string>("");
  const [asistenciaRoster, setAsistenciaRoster] = useState<{ iscrizione_id: string; nombre: string; estado: string | null; nota: string | null }[]>([]);
  const [asistenciaLoading, setAsistenciaLoading] = useState(false);
  const [asistenciaResumen, setAsistenciaResumen] = useState<{ presente: number; falta: number; justificada: number; total: number; porcentaje: number | null } | null>(null);
  const [usuariosProfile, setUsuariosProfile] = useState<IscrizioneDetalle | null>(null);
  const [usuariosProfileLoading, setUsuariosProfileLoading] = useState(false);

  // ── Puertas Abiertas state ──
  type PuertaRow = {
    id: string;
    created_at: string;
    nombre: string;
    apellido: string;
    email: string;
    telefono: string;
    disciplina_adulta: string | null;
    ninas: { nombre: string; edad: string }[];
    alergias: string | null;
    origen: string | null;
    utm_source: string | null;
    utm_campaign: string | null;
    fbclid: string | null;
  };
  const [puertasData, setPuertasData] = useState<PuertaRow[]>([]);
  const [puertasLoading, setPuertasLoading] = useState(false);
  const [puertasSearch, setPuertasSearch] = useState("");
  const [puertasDeleteId, setPuertasDeleteId] = useState<string | null>(null);

  const handleDeletePuerta = async (id: string) => {
    const res = await fetch(`/api/admin/puertas-abiertas?id=${id}`, { method: "DELETE" });
    if (res.ok) setPuertasData(prev => prev.filter(r => r.id !== id));
    setPuertasDeleteId(null);
  };

  // KPI drawer
  const [kpiDrawer, setKpiDrawer] = useState<"pendientes" | "alumnos" | "ocupacion" | "facturacion" | null>(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [kpiStudents, setKpiStudents] = useState<KpiStudentRow[]>([]);
  const [kpiStudentProfile, setKpiStudentProfile] = useState<IscrizioneDetalle | null>(null);
  const [kpiOcupacionDisciplina, setKpiOcupacionDisciplina] = useState<OcupacionDisciplina | null>(null);
  const [kpiDiscSummary, setKpiDiscSummary] = useState<{ disciplina_id: string; nombre: string; enrolled: number; maxCapacity: number }[]>([]);
  const [kpiAlumnosDisciplina, setKpiAlumnosDisciplina] = useState<{ disciplina_id: string; nombre: string } | null>(null);

  // Drawer: class detail + student profile
  const [drawerOrario, setDrawerOrario] = useState<AdminOrario | null>(null);
  const [drawerView, setDrawerView] = useState<"class" | "student">("class");
  const [drawerAlumnos, setDrawerAlumnos] = useState<OrarioAlumno[]>([]);
  const [drawerDetalle, setDrawerDetalle] = useState<IscrizioneDetalle | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const loadStats = async () => {
    const todayEs = DOW_ES[new Date().getDay()];
    const all = await fetch("/api/admin/iscrizioni").then(r => r.json()).then(j => (j.data ?? []) as { stato: string }[]);
    setIscrittiCount(all.filter(i => INSCRITA_STATI_ARR.includes(i.stato)).length);
    setPendingCount(all.filter(i => i.stato === "attesa").length);
    setBookings(all.slice(0, 5) as unknown as IscrzioneRow[]);
    return todayEs;
  };

  const handleOrarioClick = async (orario: AdminOrario) => {
    setDrawerOrario(orario);
    setDrawerView("class");
    setDrawerDetalle(null);
    setDrawerLoading(true);
    const { data } = await fetch(`/api/admin/iscrizioni?orario_id=${orario.id}`).then(r => r.json());
    setDrawerAlumnos((data as unknown as OrarioAlumno[]) ?? []);
    setDrawerLoading(false);
  };

  const handleCambiarStato = async (nuevoStato: string) => {
    if (!drawerDetalle) return;
    const res = await fetch("/api/admin/iscrizione-stato", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: drawerDetalle.id, stato: nuevoStato }),
    });
    if (res.ok) {
      ajustarMetrics(drawerDetalle, drawerDetalle.stato, nuevoStato);
      setDrawerDetalle((prev) => prev ? { ...prev, stato: nuevoStato } : prev);
      setDrawerAlumnos((prev) =>
        prev.map((a) =>
          a.iscrizione_id === drawerDetalle.id && a.iscrizioni
            ? { ...a, iscrizioni: { ...a.iscrizioni, stato: nuevoStato } }
            : a
        )
      );
    }
  };

  const handleAlumnoClick = async (iscrizioneId: string) => {
    setDrawerView("student");
    setDrawerLoading(true);
    setDeleteConfirm(false);
    const { data } = await fetch(`/api/admin/iscrizioni?id=${iscrizioneId}`).then(r => r.json());
    if (data) {
      const { data: pianoData } = await supabase
        .from("piani")
        .select("prezzo")
        .eq("id", (data as unknown as IscrizioneDetalle).piano_id)
        .eq("disciplina_id", (data as unknown as IscrizioneDetalle).disciplina_id)
        .single();
      setDrawerDetalle({ ...(data as unknown as IscrizioneDetalle), prezzo: pianoData?.prezzo ?? null });
    }
    setDrawerLoading(false);
  };

  useEffect(() => {
    if (activeSection !== "Finanzas" && activeSection !== "Resumen") return;
    setFinanzasLoading(true);
    Promise.all([
      fetch("/api/admin/iscrizioni?inscritas").then(r => r.json()).then(j => ({ data: j.data ?? [] })),
      supabase.from("piani").select("id, disciplina_id, prezzo"),
      fetch("/api/admin/costes").then(r => r.json()).then(j => ({ data: j.data ?? [] })),
    ]).then(([{ data: isc }, { data: piani }, { data: costes }]) => {
      const pm: Record<string, number> = {};
      for (const p of (piani ?? []) as { id: string; disciplina_id: string; prezzo: number }[])
        pm[`${p.id}:${p.disciplina_id}`] = p.prezzo;
      const costeMensual = ((costes ?? []) as { importe_mensual: number }[]).reduce((s, c) => s + Number(c.importe_mensual), 0);
      setFinanzasCosteMensual(costeMensual);
      const now = new Date();
      const monthly = Array.from({ length: 12 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
        const mes = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" });
        // Bono mensual recurrente: solo de quien ya lo está facturando (no la matrícula pagada).
        const mrr = ((isc ?? []) as { created_at: string; disciplina_id: string; piano_id: string; matricula: number; stato: string }[])
          .filter(v => v.created_at.substring(0, 7) <= mes && PAID_STATI.has(v.stato))
          .reduce((s, v) => s + (pm[`${v.piano_id}:${v.disciplina_id}`] ?? 0), 0);
        // Matrícula: ingreso del mes en que se cobró, para cualquier inscrita.
        const matMes = ((isc ?? []) as { created_at: string; matricula: number }[])
          .filter(v => v.created_at.substring(0, 7) === mes)
          .reduce((s, v) => s + (v.matricula ?? 0), 0);
        const ingresos = mrr + matMes;
        return { mes, label, ingresos, costes: costeMensual };
      });
      setFinanzasMensual(monthly);
      setFinanzasLoading(false);
    });
  }, [activeSection]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeSection !== "Costes") return;
    setCostesLoading(true);
    fetch("/api/admin/costes").then(r => r.json()).then(({ data }) => {
      setCostesData((data ?? []) as typeof costesData);
      setCostesLoading(false);
    });
  }, [activeSection]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeSection !== "Ventas") return;
    fetchVentas();
  }, [activeSection]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeSection !== "Asistencia") return;
    const clases = clasesDelDia(asistenciaFecha);
    const sel = clases.some(c => c.id === asistenciaOrarioId) ? asistenciaOrarioId : (clases[0]?.id ?? "");
    if (sel !== asistenciaOrarioId) setAsistenciaOrarioId(sel);
    cargarRoster(sel, asistenciaFecha);
  }, [activeSection, asistenciaFecha, orari]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeSection !== "Usuarios") return;
    setUsuariosLoading(true);
    Promise.all([
      fetch("/api/admin/iscrizioni").then(r => r.json()).then(j => ({ data: j.data ?? [] })),
      supabase.from("piani").select("id, disciplina_id, prezzo"),
    ]).then(([{ data: isc }, { data: piani }]) => {
      const pm: Record<string, number> = {};
      for (const p of (piani ?? []) as { id: string; disciplina_id: string; prezzo: number }[])
        pm[`${p.id}:${p.disciplina_id}`] = p.prezzo;
      setUsuariosData(((isc ?? []) as unknown as KpiStudentRow[]).map(i => ({ ...i, prezzo: pm[`${i.piano_id}:${i.disciplina_id}`] ?? null })));
      setUsuariosLoading(false);
    });
  }, [activeSection]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeSection !== "Puertas Abiertas") return;
    setPuertasLoading(true);
    fetch("/api/admin/puertas-abiertas")
      .then(r => r.json())
      .then(({ data }) => setPuertasData((data ?? []) as PuertaRow[]))
      .catch(() => setPuertasData([]))
      .finally(() => setPuertasLoading(false));
  }, [activeSection]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchVentas() {
    setVentasLoading(true);
    const [{ data: isc }, { data: piani }] = await Promise.all([
      fetch("/api/admin/iscrizioni").then(r => r.json()).then(j => ({ data: j.data ?? [] })),
      supabase.from("piani").select("id, disciplina_id, prezzo"),
    ]);
    const pm: Record<string, number> = {};
    for (const p of (piani ?? []) as { id: string; disciplina_id: string; prezzo: number }[])
      pm[`${p.id}:${p.disciplina_id}`] = p.prezzo;
    setVentasData(((isc ?? []) as unknown as VentaRow[]).map(i => ({ ...i, prezzo: pm[`${i.piano_id}:${i.disciplina_id}`] ?? null })));
    setVentasLoading(false);
  }

  // ── Sofia chat ──
  const sendSofiaMessage = async () => {
    const text = sofiaInput.trim();
    if (!text || sofiaLoading) return;
    const newMessages: SofiaMessage[] = [...sofiaMessages, { role: "user", content: text }];
    setSofiaMessages(newMessages);
    setSofiaInput("");
    setSofiaLoading(true);
    try {
      const res = await fetch("/api/sofia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          studioData: {
            iscrittiCount, facturacionMes, facturacionMesAnterior, pendingCount, pendingAmount,
            ocupacionMedia, nuevasInscripcionesMes, finanzasCosteMensual, objetivoFacturacion,
            objetivoProgress, objetivoAlumnos, avgPricePerStudent, finResultadoMes, ocupacionDisciplinas,
          },
        }),
      });
      const data = await res.json();
      setSofiaMessages([...newMessages, { role: "assistant", content: data.reply ?? data.error ?? "Error" }]);
    } catch {
      setSofiaMessages([...newMessages, { role: "assistant", content: "No he podido conectar. Inténtalo de nuevo." }]);
    }
    setSofiaLoading(false);
  };

  // ── Costes CRUD ──
  const handleCosteEdit = (c: { id: string; concepto: string; importe_mensual: number; importe_anual: number; notas: string | null }) => {
    setCostesEditId(c.id);
    setCostesEditVals({ concepto: c.concepto, importe_mensual: c.importe_mensual, importe_anual: c.importe_anual, notas: c.notas ?? "" });
    setCostesDeleteId(null);
  };

  const handleCosteSave = async (id: string) => {
    await fetch("/api/admin/costes", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, concepto: costesEditVals.concepto, importe_mensual: costesEditVals.importe_mensual, importe_anual: costesEditVals.importe_anual, notas: costesEditVals.notas || null }),
    });
    setCostesData(prev => prev.map(c => c.id === id ? { ...c, ...costesEditVals, notas: costesEditVals.notas || null } : c));
    setCostesEditId(null);
  };

  const handleCosteDelete = async (id: string) => {
    await fetch(`/api/admin/costes?id=${id}`, { method: "DELETE" });
    setCostesData(prev => prev.filter(c => c.id !== id));
    setCostesDeleteId(null);
  };

  const handleInlineNuevoSave = async (categoria: string) => {
    if (!inlineNuevo.concepto.trim()) return;
    const res = await fetch("/api/admin/costes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoria, concepto: inlineNuevo.concepto, importe_mensual: inlineNuevo.importe_mensual, importe_anual: inlineNuevo.importe_anual, notas: inlineNuevo.notas || null }),
    });
    const { data } = await res.json();
    if (data) setCostesData(prev => [...prev, data as CosteRow]);
    setAddingToCategoria(null);
    setInlineNuevo({ concepto: "", importe_mensual: 0, importe_anual: 0, notas: "" });
  };

  const handleNuevoCostoSubmit = async () => {
    if (!nuevoCosto.concepto) return;
    const res = await fetch("/api/admin/costes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoria: nuevoCosto.categoria, concepto: nuevoCosto.concepto, importe_mensual: nuevoCosto.importe_mensual, importe_anual: nuevoCosto.importe_anual, notas: nuevoCosto.notas || null }),
    });
    const { data } = await res.json();
    if (data) setCostesData(prev => [...prev, data as { id: string; categoria: string; concepto: string; importe_mensual: number; importe_anual: number; notas: string | null }]);
    setShowNuevoCosto(false);
    setNuevoCosto({ categoria: "Otros", concepto: "", importe_mensual: 0, importe_anual: 0, notas: "" });
  };

  // ── Eliminar alumno ──
  const handleEliminarAlumno = async () => {
    if (!drawerDetalle) return;
    setDeleteLoading(true);
    await fetch("/api/admin/delete-iscrizione", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: drawerDetalle.id }),
    });
    if (drawerDetalle.stato === "attesa") {
      setPendingCount(p => Math.max(0, p - 1));
      setPendingAmount(p => Math.max(0, p - (drawerDetalle.prezzo ?? 0)));
    } else if (isPaid(drawerDetalle.stato)) {
      setIscrittiCount(p => Math.max(0, p - 1));
      setFacturacionMes(p => Math.max(0, p - (drawerDetalle.prezzo ?? 0) - (drawerDetalle.matricula ?? 0)));
    }
    setDrawerOrario(null);
    setDeleteConfirm(false);
    setDeleteLoading(false);
    setBookings(prev => prev.filter(b => b.id !== drawerDetalle.id));
  };

  // ── Nueva inscripción ──
  const handleNifDisciplinaChange = async (disciplina_id: string) => {
    setNif(p => ({ ...p, disciplina_id, piano_id: "", horarios: [] }));
    if (!disciplina_id) return;
    const { data } = await supabase.from("piani").select("id, nome, prezzo").eq("disciplina_id", disciplina_id);
    setNifPiani((data ?? []) as { id: string; nome: string; prezzo: number }[]);
  };

  const handleNuevaInscripcionSubmit = async () => {
    if (!nif.nome || !nif.cognome || !nif.email || !nif.disciplina_id || !nif.piano_id) return;
    setNifLoading(true);
    const res = await fetch("/api/inscripcion", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contatto: { nome: nif.nome, cognome: nif.cognome, email: nif.email, telefono: nif.telefono || null },
        inscripciones: [{
          disciplina_id: nif.disciplina_id, piano_id: nif.piano_id,
          nome: nif.nome, cognome: nif.cognome, email: nif.email, telefono: nif.telefono || null,
          metodo_pagamento: nif.metodo_pagamento,
          nome_alumna: nif.nome_alumna || null, cognome_alumna: nif.cognome_alumna || null,
          matricula: 0, horarios: nif.horarios,
        }],
      }),
    });
    if (!res.ok) { setNifLoading(false); return; }
    const newPrezzo = nifPiani.find(p => p.id === nif.piano_id)?.prezzo ?? 0;
    setPendingCount(p => p + 1);
    setPendingAmount(p => p + newPrezzo);
    // Fire-and-forget confirmation email
    const disciplinaNombre = orari.find(o => o.disciplina_id === nif.disciplina_id)?.discipline?.nome ?? nif.disciplina_id;
    const planNombre = nifPiani.find(p => p.id === nif.piano_id)?.nome ?? nif.piano_id;
    const horariosStr = nif.horarios.map(id => {
      const o = orari.find(or => or.id === id);
      return o ? `${o.giorno} ${o.ora_inizio}–${o.ora_fine}` : id;
    });
    fetch("/api/send-confirmation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: nif.email.toLowerCase().trim(),
        nombre: nif.nome,
        apellido: nif.cognome,
        inscripciones: [{
          disciplina: disciplinaNombre,
          plan: planNombre,
          precio: newPrezzo,
          horarios: horariosStr,
          ...(nif.nome_alumna ? { alumna: { nombre: nif.nome_alumna, apellido: nif.cognome_alumna ?? "" } } : {}),
        }],
        totalMensual: newPrezzo,
        metodoPago: nif.metodo_pagamento,
      }),
    }).catch(() => {});
    setNif({ nome: "", cognome: "", email: "", telefono: "", disciplina_id: "", piano_id: "", metodo_pagamento: "en-escuela", nome_alumna: "", cognome_alumna: "", horarios: [] });
    setNifPiani([]);
    setShowNuevaInscripcion(false);
    setNifLoading(false);
  };

  // ── Nuevo horario ──
  const handleNuevoHorarioSubmit = async () => {
    if (!nhf.disciplina_id || !nhf.giorno || !nhf.ora_inizio || !nhf.ora_fine) return;
    setNhfLoading(true);
    await supabase.from("orari").insert({ disciplina_id: nhf.disciplina_id, giorno: nhf.giorno, ora_inizio: nhf.ora_inizio, ora_fine: nhf.ora_fine, posti_totali: nhf.posti_totali, attivo: true });
    setShowNuevoHorario(false);
    setNhf({ disciplina_id: "", giorno: "Lunes", ora_inizio: "09:00", ora_fine: "10:00", posti_totali: 10 });
    setNhfLoading(false);
    // Reload orari
    const { data } = await supabase.from("orari").select("id, giorno, ora_inizio, ora_fine, disciplina_id, posti_totali, discipline(nome), iscrizione_orari(iscrizione_id)").eq("attivo", true);
    if (data) setOrari(data as unknown as AdminOrario[]);
  };

  const ajustarMetrics = (iscrizione: { prezzo?: number | null; matricula?: number | null }, fromStato: string, toStato: string) => {
    const prezzo = iscrizione.prezzo ?? 0;
    const mat = iscrizione.matricula ?? 0;
    if (fromStato === "attesa" && isPaid(toStato)) {
      setPendingAmount((p) => p - prezzo);
      setPendingCount((p) => p - 1);
      setFacturacionMes((p) => p + prezzo + mat);
      setIscrittiCount((p) => p + 1);
    } else if (isPaid(fromStato) && toStato === "attesa") {
      setPendingAmount((p) => p + prezzo);
      setPendingCount((p) => p + 1);
      setFacturacionMes((p) => p - prezzo - mat);
      setIscrittiCount((p) => Math.max(0, p - 1));
    }
  };

  const fetchKpiStudents = async (filter?: { stato: string }) => {
    setKpiLoading(true);
    setKpiStudentProfile(null);
    setKpiOcupacionDisciplina(null);
    const url = filter ? `/api/admin/iscrizioni?stato=${encodeURIComponent(filter.stato)}` : "/api/admin/iscrizioni";
    const [{ data: isc }, { data: piani }] = await Promise.all([
      fetch(url).then(r => r.json()).then(j => ({ data: j.data ?? [] })),
      supabase.from("piani").select("id, disciplina_id, prezzo"),
    ]);
    const pm: Record<string, number> = {};
    for (const p of (piani ?? []) as { id: string; disciplina_id: string; prezzo: number }[]) pm[`${p.id}:${p.disciplina_id}`] = p.prezzo;
    setKpiStudents(((isc ?? []) as unknown as KpiStudentRow[]).map((i) => ({ ...i, prezzo: pm[`${i.piano_id}:${i.disciplina_id}`] ?? null })));
    setKpiLoading(false);
  };

  const handleKpiStudentClick = async (id: string) => {
    setKpiLoading(true);
    const { data } = await fetch(`/api/admin/iscrizioni?id=${id}`).then(r => r.json());
    if (data) {
      const { data: pd } = await supabase.from("piani").select("prezzo").eq("id", (data as unknown as IscrizioneDetalle).piano_id).eq("disciplina_id", (data as unknown as IscrizioneDetalle).disciplina_id).single();
      setKpiStudentProfile({ ...(data as unknown as IscrizioneDetalle), prezzo: pd?.prezzo ?? null });
    }
    setKpiLoading(false);
  };

  const handleCambiarStatoKpi = async (nuevoStato: string) => {
    if (!kpiStudentProfile) return;
    const res = await fetch("/api/admin/iscrizione-stato", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: kpiStudentProfile.id, stato: nuevoStato }),
    });
    if (res.ok) {
      ajustarMetrics(kpiStudentProfile, kpiStudentProfile.stato, nuevoStato);
      setKpiStudentProfile((p) => p ? { ...p, stato: nuevoStato } : p);
      setKpiStudents((prev) => prev.map((s) => s.id === kpiStudentProfile.id ? { ...s, stato: nuevoStato } : s));
    }
  };

  const handleUsuarioClick = async (id: string) => {
    setUsuariosProfileLoading(true);
    setUsuariosProfile(null);
    setConfirmCancelSub(false);
    setAsistenciaResumen(null);
    fetch(`/api/admin/asistencia?iscrizione_id=${id}`)
      .then(r => r.json())
      .then(j => setAsistenciaResumen(j.resumen ?? null))
      .catch(() => {});
    const { data } = await fetch(`/api/admin/iscrizioni?id=${id}`).then(r => r.json());
    if (data) {
      const { data: pd } = await supabase.from("piani").select("prezzo").eq("id", (data as unknown as IscrizioneDetalle).piano_id).eq("disciplina_id", (data as unknown as IscrizioneDetalle).disciplina_id).single();
      setUsuariosProfile({ ...(data as unknown as IscrizioneDetalle), prezzo: pd?.prezzo ?? null });
    }
    setUsuariosProfileLoading(false);
  };

  // ── Cancelar suscripción del bono (la madre se da de baja) ──
  const [cancelandoSub, setCancelandoSub] = useState(false);
  const [confirmCancelSub, setConfirmCancelSub] = useState(false);
  const handleCancelarSuscripcion = async () => {
    if (!usuariosProfile) return;
    setCancelandoSub(true);
    const res = await fetch("/api/admin/cancel-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ iscrizioneId: usuariosProfile.id }),
    });
    if (res.ok) {
      setUsuariosProfile(p => p ? { ...p, stato: "cancelada" } : p);
      setUsuariosData(prev => prev.map(u => u.id === usuariosProfile.id ? { ...u, stato: "cancelada" } : u));
    }
    setCancelandoSub(false);
    setConfirmCancelSub(false);
  };

  const handleCambiarStatoUsuario = async (nuevoStato: string) => {
    if (!usuariosProfile) return;
    const res = await fetch("/api/admin/iscrizione-stato", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: usuariosProfile.id, stato: nuevoStato }),
    });
    if (res.ok) {
      ajustarMetrics(usuariosProfile, usuariosProfile.stato, nuevoStato);
      setUsuariosProfile(p => p ? { ...p, stato: nuevoStato } : p);
      setUsuariosData(prev => prev.map(u => u.id === usuariosProfile.id ? { ...u, stato: nuevoStato } : u));
    }
  };

  const handleEliminarUsuario = async () => {
    if (!usuariosProfile) return;
    await fetch("/api/admin/delete-iscrizione", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: usuariosProfile.id }),
    });
    if (usuariosProfile.stato === "attesa") {
      setPendingCount(p => Math.max(0, p - 1));
      setPendingAmount(p => Math.max(0, p - (usuariosProfile.prezzo ?? 0)));
    } else if (isPaid(usuariosProfile.stato)) {
      setIscrittiCount(p => Math.max(0, p - 1));
      setFacturacionMes(p => Math.max(0, p - (usuariosProfile.prezzo ?? 0) - (usuariosProfile.matricula ?? 0)));
    }
    setBookings(prev => prev.filter(b => b.id !== usuariosProfile.id));
    setUsuariosData(prev => prev.filter(u => u.id !== usuariosProfile.id));
    setUsuariosProfile(null);
  };

  // ── Borrado rápido desde tabla (Usuarios / Reservas Recientes) ──
  const [rowDeleteId, setRowDeleteId] = useState<string | null>(null);
  const [rowDeleting, setRowDeleting] = useState(false);
  const handleEliminarRow = async (id: string, stato: string, prezzo?: number | null, matricula?: number | null) => {
    setRowDeleting(true);
    const res = await fetch("/api/admin/delete-iscrizione", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      if (stato === "attesa") {
        setPendingCount(p => Math.max(0, p - 1));
        setPendingAmount(p => Math.max(0, p - (prezzo ?? 0)));
      } else if (isPaid(stato)) {
        setIscrittiCount(p => Math.max(0, p - 1));
        setFacturacionMes(p => Math.max(0, p - (prezzo ?? 0) - (matricula ?? 0)));
      } else if (stato === "matricula_pagada") {
        setIscrittiCount(p => Math.max(0, p - 1));
        setFacturacionMes(p => Math.max(0, p - (matricula ?? 0)));
      }
      setBookings(prev => prev.filter(b => b.id !== id));
      setUsuariosData(prev => prev.filter(u => u.id !== id));
    }
    setRowDeleting(false);
    setRowDeleteId(null);
  };

  // Listado de alumnas que contribuyen a la facturación del mes (matrícula y/o bono).
  const handleKpiFacturacion = async () => {
    setKpiDrawer("facturacion");
    setKpiStudentProfile(null);
    setKpiAlumnosDisciplina(null);
    setKpiOcupacionDisciplina(null);
    setKpiStudents([]);
    setKpiLoading(true);
    const [{ data: isc }, { data: piani }] = await Promise.all([
      fetch("/api/admin/iscrizioni?inscritas").then(r => r.json()).then(j => ({ data: j.data ?? [] })),
      supabase.from("piani").select("id, disciplina_id, prezzo"),
    ]);
    const pm: Record<string, number> = {};
    for (const p of (piani ?? []) as { id: string; disciplina_id: string; prezzo: number }[]) pm[`${p.id}:${p.disciplina_id}`] = p.prezzo;
    setKpiStudents(((isc ?? []) as unknown as KpiStudentRow[]).map((i) => ({ ...i, prezzo: pm[`${i.piano_id}:${i.disciplina_id}`] ?? null })));
    setKpiLoading(false);
  };

  const handleKpiAlumnos = async () => {
    setKpiDrawer("alumnos");
    setKpiStudentProfile(null);
    setKpiAlumnosDisciplina(null);
    setKpiStudents([]);
    setKpiLoading(true);
    const { data: isc } = await fetch("/api/admin/iscrizioni?inscritas").then(r => r.json());
    const countMap: Record<string, { nombre: string; count: number }> = {};
    for (const i of (isc ?? []) as unknown as { disciplina_id: string; discipline: { nome: string } | null }[]) {
      const did = i.disciplina_id;
      if (!countMap[did]) countMap[did] = { nombre: i.discipline?.nome ?? did, count: 0 };
      countMap[did].count++;
    }
    const capMap: Record<string, number> = {};
    for (const o of orari) capMap[o.disciplina_id] = (capMap[o.disciplina_id] ?? 0) + o.posti_totali;
    for (const did in capMap) capMap[did] = Math.round(capMap[did] / 2);
    setKpiDiscSummary(
      Object.entries(countMap).map(([disciplina_id, { nombre, count }]) => ({
        disciplina_id, nombre, enrolled: count, maxCapacity: capMap[disciplina_id] ?? 0,
      }))
    );
    setKpiLoading(false);
  };

  const handleKpiDisciplinaClick = async (disc: { disciplina_id: string; nombre: string }) => {
    setKpiAlumnosDisciplina(disc);
    setKpiLoading(true);
    const [{ data: iscAll }, { data: piani }] = await Promise.all([
      fetch("/api/admin/iscrizioni?inscritas").then(r => r.json()).then(j => ({ data: j.data ?? [] })),
      supabase.from("piani").select("id, disciplina_id, prezzo"),
    ]);
    const isc = ((iscAll ?? []) as KpiStudentRow[]).filter(i => i.disciplina_id === disc.disciplina_id);
    const pm: Record<string, number> = {};
    for (const p of (piani ?? []) as { id: string; disciplina_id: string; prezzo: number }[]) pm[`${p.id}:${p.disciplina_id}`] = p.prezzo;
    setKpiStudents((isc as unknown as KpiStudentRow[]).map((i) => ({ ...i, prezzo: pm[`${i.piano_id}:${i.disciplina_id}`] ?? null })));
    setKpiLoading(false);
  };

  useEffect(() => {
    const todayEs = DOW_ES[new Date().getDay()];
    Promise.all([
      fetch("/api/admin/iscrizioni").then(r => r.json()).then(j => (j.data ?? []) as Array<{ id: string; stato: string; created_at: string; disciplina_id: string; piano_id: string; matricula: number; [k: string]: unknown }>),
      supabase.from("orari").select("*", { count: "exact", head: true }).eq("giorno", todayEs).eq("attivo", true),
      supabase.from("orari").select("id, giorno, ora_inizio, ora_fine, disciplina_id, posti_totali, discipline(nome), iscrizione_orari(iscrizione_id)").eq("attivo", true),
      supabase.from("piani").select("id, disciplina_id, prezzo"),
    ]).then(([allIsc, r2, r4, r7]) => {
      setIscrittiCount(allIsc.filter(i => INSCRITA_STATI_ARR.includes(i.stato)).length);
      setLezioniCount(r2.count ?? 0);
      setPendingCount(allIsc.filter(i => i.stato === "attesa").length);
      const orariData = (r4.data as unknown as AdminOrario[]) ?? [];
      setOrari(orariData);
      setBookings(allIsc.slice(0, 5) as unknown as IscrzioneRow[]);

      // Build price map: `${piano_id}:${disciplina_id}` → prezzo
      const pm: Record<string, number> = {};
      for (const p of (r7.data ?? []) as { id: string; disciplina_id: string; prezzo: number }[])
        pm[`${p.id}:${p.disciplina_id}`] = p.prezzo;

      const now2 = new Date();
      const tm = now2.getMonth(), ty = now2.getFullYear();
      const curMonthStr = `${ty}-${String(tm + 1).padStart(2, "0")}`;
      let factMes = 0, factAnt = 0, pendAmt = 0;
      for (const isc of allIsc) {
        const prezzo = pm[`${isc.piano_id}:${isc.disciplina_id}`] ?? 0;
        const mat = isc.matricula ?? 0;
        if (isc.stato === "attesa") {
          pendAmt += prezzo;
        } else if (isPaid(isc.stato)) {
          factMes += prezzo + mat;
          if (isc.created_at.substring(0, 7) < curMonthStr) factAnt += prezzo + mat;
        } else if (isc.stato === "matricula_pagada") {
          // El bono empieza en septiembre: hoy solo cuenta la matrícula.
          factMes += mat;
          if (isc.created_at.substring(0, 7) < curMonthStr) factAnt += mat;
        }
      }
      setFacturacionMes(factMes);
      setFacturacionMesAnterior(factAnt);
      setPendingAmount(pendAmt);
      const nuevasEstesMes = allIsc.filter(i => {
        const d = new Date(i.created_at);
        return d.getMonth() === tm && d.getFullYear() === ty;
      }).length;
      setNuevasInscripcionesMes(nuevasEstesMes);

      // Precio medio por alumna (sobre todas las pagato)
      const pagati = allIsc.filter(i => isPaid(i.stato));
      const totalPagati = pagati.reduce((s, i) => s + (pm[`${i.piano_id}:${i.disciplina_id}`] ?? 0), 0);
      setAvgPricePerStudent(pagati.length > 0 ? totalPagati / pagati.length : 0);

      // Ocupación por disciplina
      // ocupados = alumnas únicas (Set de iscrizione_id)
      // total = sum(posti_totali) / 2  → cada alumna va a 2 clases/semana
      const dm: Record<string, OcupacionDisciplina> = {};
      const discIscIds: Record<string, Set<string>> = {};
      for (const o of orariData) {
        const sesOcupados = o.iscrizione_orari?.length ?? 0;
        if (!dm[o.disciplina_id]) {
          dm[o.disciplina_id] = { disciplina_id: o.disciplina_id, nombre: o.discipline?.nome ?? o.disciplina_id, ocupados: 0, total: 0, clases: [] };
          discIscIds[o.disciplina_id] = new Set();
        }
        for (const x of o.iscrizione_orari ?? []) discIscIds[o.disciplina_id].add(x.iscrizione_id);
        dm[o.disciplina_id].total += o.posti_totali;
        dm[o.disciplina_id].clases.push({ id: o.id, giorno: o.giorno, ora_inizio: o.ora_inizio, ora_fine: o.ora_fine, ocupados: sesOcupados, total: o.posti_totali });
      }
      for (const [did, ids] of Object.entries(discIscIds)) {
        dm[did].ocupados = ids.size;
        dm[did].total = Math.round(dm[did].total / 2);
      }
      const discList = Object.values(dm);
      const totOc = discList.reduce((s, d) => s + d.ocupados, 0);
      const totPl = discList.reduce((s, d) => s + d.total, 0);
      setOcupacionMedia(totPl > 0 ? Math.round((totOc / totPl) * 100) : 0);
      setOcupacionDisciplinas(discList);

      setLoading(false);
    });

    const channel = supabase
      .channel("iscrizioni-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "iscrizioni" }, () => {
        loadStats();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "iscrizioni" }, () => {
        loadStats();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const weekDates = getWeekDates();
  const times = [...new Set(orari.map((o) => o.ora_inizio.substring(0, 5)))].sort();
  const grid = buildGrid(orari);

  // ── Finanzas computations ──
  const meseActual = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
  const finActual = finanzasMensual.find(m => m.mes === meseActual);
  const finPrev = finanzasMensual[finanzasMensual.length - 2];
  const finIngresosMes = finActual?.ingresos ?? 0;
  const finCosteMes = finanzasCosteMensual;
  const finResultadoMes = finIngresosMes - finCosteMes;
  const finMargen = finIngresosMes > 0 ? (finResultadoMes / finIngresosMes) * 100 : 0;
  const finResultadoPrev = (finPrev?.ingresos ?? 0) - (finPrev?.costes ?? 0);
  const finResultadoDiff = finResultadoPrev !== 0 ? ((finResultadoMes - finResultadoPrev) / Math.abs(finResultadoPrev)) * 100 : null;
  const ytdMeses = finanzasMensual.filter(m => m.mes.startsWith(String(new Date().getFullYear())));
  const finIngresosYTD = ytdMeses.reduce((s, m) => s + m.ingresos, 0);
  const finCostesYTD = ytdMeses.reduce((s, m) => s + m.costes, 0);
  const finResultadoYTD = finIngresosYTD - finCostesYTD;
  const finChart6 = finanzasMensual.slice(-6);

  // ── Objetivo mensual progresivo ──
  const schoolYearMes = getSchoolYearMonth();
  const targetMargin = 0.15 + (schoolYearMes - 1) * 0.025;
  const objetivoFacturacion = finanzasCosteMensual > 0 ? Math.round(finanzasCosteMensual * (1 + targetMargin)) : 0;
  const objetivoProgress = objetivoFacturacion > 0 ? Math.min(100, Math.round((facturacionMes / objetivoFacturacion) * 100)) : 0;
  const objetivoAlumnos = avgPricePerStudent > 0 ? Math.ceil(objetivoFacturacion / avgPricePerStudent) : 0;
  const objetivoAlumnosProgress = objetivoAlumnos > 0 ? Math.min(100, Math.round((iscrittiCount / objetivoAlumnos) * 100)) : 0;

  // ── Discipline disponibili (da orari) ──
  const disciplinasDisponibles = [...new Map(orari.map(o => [o.disciplina_id, { id: o.disciplina_id, nome: o.discipline?.nome ?? o.disciplina_id }])).values()];
  const orariosForNif = orari.filter(o => o.disciplina_id === nif.disciplina_id);
  const esNinaNif = NINAS_IDS.has(nif.disciplina_id);

  // ── Costes computations ──
  const costesTotalMensual = costesData.reduce((s, c) => s + c.importe_mensual, 0);
  const costesTotalAnual = costesData.reduce((s, c) => s + c.importe_anual, 0);
  const costesCategorias = Object.entries(
    costesData.reduce<Record<string, number>>((acc, c) => {
      acc[c.categoria] = (acc[c.categoria] ?? 0) + c.importe_mensual;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);
  const maxCategoriaCost = Math.max(...costesCategorias.map(c => c[1]), 1);
  const CATEGORIA_ICON: Record<string, string> = {
    "Andrea": "person",
    "Local": "home",
    "Seguros": "shield",
    "Software & Marketing": "campaign",
    "Otros": "more_horiz",
  };

  // ── Ventas computations ──
  const mesesOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1);
    return {
      val: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("es-ES", { month: "long", year: "numeric" }),
    };
  });
  const [vYear, vMonth] = ventasMes.split("-").map(Number);
  const ventasMesFiltradas = ventasData.filter(v => v.created_at.startsWith(ventasMes));
  const prevMesStr = vMonth === 1 ? `${vYear - 1}-12` : `${vYear}-${String(vMonth - 1).padStart(2, "0")}`;
  const ventasPrevMes = ventasData.filter(v => v.created_at.startsWith(prevMesStr));
  // Ingreso real aportado por una inscripción: cuota cobrándose + matrícula cuando está
  // pagada; solo matrícula si el bono aún no ha arrancado (matricula_pagada, empieza en sept.).
  const ingresoFila = (v: VentaRow) => {
    const prezzo = v.prezzo ?? 0;
    const mat = v.matricula ?? 0;
    if (isPaid(v.stato)) return prezzo + mat;
    if (v.stato === "matricula_pagada") return mat;
    return 0;
  };
  const pagadasMes = ventasMesFiltradas.filter(v => ingresoFila(v) > 0);
  const ingresosMesV = pagadasMes.reduce((s, v) => s + ingresoFila(v), 0);
  const ingresosMesAntV = ventasPrevMes.reduce((s, v) => s + ingresoFila(v), 0);
  const ingresosDiff = ingresosMesAntV > 0 ? ((ingresosMesV - ingresosMesAntV) / ingresosMesAntV) * 100 : null;
  const ticketMedioV = pagadasMes.length > 0 ? ingresosMesV / pagadasMes.length : 0;
  const pendientesCountV = ventasMesFiltradas.filter(v => v.stato === "attesa").length;
  const daysInMonth = new Date(vYear, vMonth, 0).getDate();
  const ventasChartData = ventasGranularity === "diario"
    ? Array.from({ length: daysInMonth }, (_, i) => {
        const dayStr = `${ventasMes}-${String(i + 1).padStart(2, "0")}`;
        const rows = ventasMesFiltradas.filter(v => v.created_at.startsWith(dayStr));
        return { label: String(i + 1), ingresos: rows.reduce((s, v) => s + ingresoFila(v), 0), inscripciones: rows.length };
      })
    : [1, 2, 3, 4].map(w => {
        const start = (w - 1) * 7 + 1;
        const end = w === 4 ? daysInMonth : w * 7;
        const rows = ventasMesFiltradas.filter(v => { const d = new Date(v.created_at).getDate(); return d >= start && d <= end; });
        return { label: `Sem ${w}`, ingresos: rows.reduce((s, v) => s + ingresoFila(v), 0), inscripciones: rows.length };
      });
  const discMap: Record<string, { nombre: string; ingresos: number; count: number }> = {};
  pagadasMes.forEach(v => {
    if (!discMap[v.disciplina_id]) discMap[v.disciplina_id] = { nombre: v.discipline?.nome ?? v.disciplina_id, ingresos: 0, count: 0 };
    discMap[v.disciplina_id].ingresos += ingresoFila(v);
    discMap[v.disciplina_id].count++;
  });
  const discBreakdown = Object.values(discMap).sort((a, b) => b.ingresos - a.ingresos);
  const maxDisc = Math.max(...discBreakdown.map(d => d.ingresos), 1);
  const planMapV: Record<string, { nombre: string; ingresos: number; count: number }> = {};
  pagadasMes.forEach(v => {
    if (!planMapV[v.piano_id]) planMapV[v.piano_id] = { nombre: PLAN_LABEL[v.piano_id] ?? v.piano_id, ingresos: 0, count: 0 };
    planMapV[v.piano_id].ingresos += ingresoFila(v);
    planMapV[v.piano_id].count++;
  });
  const planBreakdownV = Object.values(planMapV).sort((a, b) => b.ingresos - a.ingresos);
  const maxPlan = Math.max(...planBreakdownV.map(p => p.ingresos), 1);

  // Clases de hoy (para el bloque "Para hoy" del Resumen).
  const todayEs = DOW_ES[new Date().getDay()];
  const clasesHoy = orari
    .filter(o => o.giorno === todayEs)
    .sort((a, b) => a.ora_inizio.localeCompare(b.ora_inizio));

  // ── Asistencia ──
  // Clases activas en el día de la semana de una fecha dada.
  const clasesDelDia = (fecha: string) =>
    orari
      .filter(o => o.giorno === DOW_ES[new Date(`${fecha}T00:00:00`).getDay()])
      .sort((a, b) => a.ora_inizio.localeCompare(b.ora_inizio));

  const cargarRoster = async (orarioId: string, fecha: string) => {
    if (!orarioId) { setAsistenciaRoster([]); return; }
    setAsistenciaLoading(true);
    try {
      const res = await fetch(`/api/admin/asistencia?orario_id=${orarioId}&fecha=${fecha}`);
      const json = await res.json();
      setAsistenciaRoster(json.alumnas ?? []);
    } catch { setAsistenciaRoster([]); }
    setAsistenciaLoading(false);
  };

  // Marca (o desmarca, si se pulsa el estado ya activo) la asistencia de una alumna.
  const marcarAsistencia = async (iscrizioneId: string, estado: string) => {
    const actual = asistenciaRoster.find(a => a.iscrizione_id === iscrizioneId)?.estado;
    const nuevo = actual === estado ? null : estado;
    setAsistenciaRoster(prev => prev.map(a => a.iscrizione_id === iscrizioneId ? { ...a, estado: nuevo } : a));
    if (nuevo === null) {
      await fetch(`/api/admin/asistencia?iscrizione_id=${iscrizioneId}&orario_id=${asistenciaOrarioId}&fecha=${asistenciaFecha}`, { method: "DELETE" });
    } else {
      await fetch("/api/admin/asistencia", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iscrizione_id: iscrizioneId, orario_id: asistenciaOrarioId, fecha: asistenciaFecha, estado: nuevo }),
      });
    }
  };

  const marcarTodasPresentes = async () => {
    const objetivo = asistenciaRoster.filter(a => a.estado !== "presente");
    if (objetivo.length === 0) return;
    setAsistenciaRoster(prev => prev.map(a => ({ ...a, estado: "presente" })));
    await Promise.all(objetivo.map(a => fetch("/api/admin/asistencia", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ iscrizione_id: a.iscrizione_id, orario_id: asistenciaOrarioId, fecha: asistenciaFecha, estado: "presente" }),
    })));
  };

  const handleLogout = async () => {
    try { await fetch("/api/admin/logout", { method: "POST" }); } catch {}
    window.location.href = "/admin/login";
  };

  const navItems = [
    { icon: "dashboard", label: "Resumen" },
    { icon: "calendar_month", label: "Calendario" },
    { icon: "checklist", label: "Asistencia" },
    { icon: "group", label: "Usuarios" },
    { icon: "celebration", label: "Puertas Abiertas" },
    { icon: "receipt_long", label: "Costes" },
    { icon: "trending_up", label: "Ventas" },
    { icon: "account_balance", label: "Finanzas" },
    { icon: "diamond", label: "Sofía" },
  ];

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex">

      {/* ── Overlay backdrop (mobile) ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <nav
        className={`bg-surface-container-low text-primary h-screen w-64 fixed left-0 top-0 border-r border-outline-variant flex flex-col py-gutter px-4 z-50 transition-transform duration-300
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 md:w-56`}
      >
        {/* Close button (mobile only) */}
        <button
          className="absolute top-4 right-4 md:hidden text-on-surface-variant"
          onClick={() => setSidebarOpen(false)}
          aria-label="Cerrar menú"
        >
          <Icon name="close" />
        </button>

        {/* Logo — full on mobile, compact on desktop */}
        <div className="mb-stack-lg flex flex-col items-center md:mb-4 md:pt-2">
          <Image
            src="/logo.png"
            alt="Logo Andrea Carrió Studio"
            width={96}
            height={96}
            className="rounded-full object-cover mb-4 md:w-12 md:h-12 md:mb-2"
          />
          <h1 className="font-display-lg text-2xl font-semibold text-primary text-center tracking-tight md:text-sm md:font-bold">
            Studio Admin
          </h1>
          <p className="font-label-md text-label-md text-on-surface-variant md:hidden">Gestión del Estudio</p>
        </div>

        {/* Action buttons — visible on mobile, hidden on desktop (moved to top bar) */}
        <button onClick={() => setShowNuevoHorario(true)} className="bg-primary text-on-primary rounded-full py-3 px-6 mb-2 font-label-md text-label-md hover:bg-secondary transition-colors flex items-center justify-center gap-2 md:hidden">
          <Icon name="add" className="text-base" /> Nueva Clase
        </button>
        <button onClick={() => setShowNuevaInscripcion(true)} className="rounded-full py-3 px-6 mb-stack-md font-label-md text-label-md border transition-colors flex items-center justify-center gap-2 hover:bg-surface-container-high md:hidden" style={{ borderColor: "#dcc1b9", color: "#7d2b13" }}>
          <Icon name="person_add" className="text-base" /> Añadir alumna
        </button>

        <ul className="flex-1 space-y-1 overflow-y-auto min-h-0 md:space-y-0.5">
          {navItems.map((item) => (
            <li key={item.label}>
              <a
                href="#"
                onClick={() => { setActiveSection(item.label); setSidebarOpen(false); }}
                className={`flex items-center px-4 py-3 rounded-xl transition-all font-label-md text-label-md md:py-3 md:px-3 md:rounded-lg ${
                  activeSection === item.label
                    ? "text-primary bg-surface-container-highest font-bold border-l-4 border-primary md:border-l-[3px]"
                    : "text-on-surface-variant hover:text-primary hover:bg-surface-container-high duration-200"
                }`}
              >
                <Icon name={item.icon} className="mr-3 md:mr-2.5 md:text-[18px]" />
                {item.label}
              </a>
            </li>
          ))}
        </ul>

        <ul className="mt-auto space-y-1 border-t border-outline-variant pt-4 md:space-y-0.5">
          <li>
            <a
              href="/admin/email-preview"
              target="_blank"
              className="flex items-center px-4 py-3 rounded-xl text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors duration-200 font-label-md text-label-md md:py-2.5 md:px-3 md:rounded-lg md:text-sm"
            >
              <Icon name="mail_outline" className="mr-3 md:mr-2.5 md:text-[18px]" />
              Preview email
            </a>
          </li>
          <li>
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-4 py-3 rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-colors duration-200 font-label-md text-label-md md:py-2.5 md:px-3 md:rounded-lg md:text-sm"
              style={{ color: "#b71c1c" }}
            >
              <Icon name="logout" className="mr-3 md:mr-2.5 md:text-[18px]" />
              Cerrar sesión
            </button>
          </li>
        </ul>
      </nav>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-h-screen md:ml-56">

        {/* Top bar */}
        <header className="bg-surface/80 backdrop-blur-md border-b border-outline-variant fixed top-0 left-0 right-0 md:left-56 h-16 shadow-sm flex justify-between items-center px-4 md:px-margin-desktop z-40">
          {/* Hamburger (mobile only) */}
          <button
            className="md:hidden p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
          >
            <Icon name="menu" />
          </button>

          <h2 className="font-title-lg text-title-lg text-secondary hidden md:block">
            {activeSection}
          </h2>
          <p className="font-title-lg text-title-lg text-secondary md:hidden text-sm">
            Studio Admin
          </p>

          {/* Action buttons — desktop only */}
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => setShowNuevoHorario(true)}
              className="flex items-center gap-1.5 bg-primary text-on-primary rounded-full py-2 px-4 text-sm font-semibold hover:bg-secondary transition-colors"
            >
              <Icon name="add" className="text-base" /> Nueva Clase
            </button>
            <button
              onClick={() => setShowNuevaInscripcion(true)}
              className="flex items-center gap-1.5 rounded-full py-2 px-4 text-sm font-semibold border hover:bg-surface-container-high transition-colors"
              style={{ borderColor: "#dcc1b9", color: "#7d2b13" }}
            >
              <Icon name="person_add" className="text-base" /> Añadir alumna
            </button>
            <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-semibold text-sm border-2 border-surface-container-high ml-2">
              AC
            </div>
          </div>

          {/* Avatar — mobile only */}
          <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-semibold text-sm border-2 border-surface-container-high md:hidden">
            AC
          </div>
        </header>

        {/* Content */}
        <main className="pt-[80px] p-4 md:p-margin-desktop flex-1 overflow-y-auto space-y-section-gap">

          {/* ── Resumen ── */}
          {activeSection === "Resumen" && (
            <section className="space-y-8">

              <div>
                <h3 className="font-headline-md text-headline-md text-primary mb-1">Resumen del Estudio</h3>
                <p className="text-sm" style={{ color: "#89726c" }}>{new Date().toLocaleDateString("es-ES", { month: "long", year: "numeric" })}</p>
              </div>

              {/* Para hoy */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#89726c" }}>Para hoy</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                  {/* Clases de hoy */}
                  <div className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-surface-container-high">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-2 rounded-full bg-secondary-container text-on-secondary-container"><Icon name="calendar_today" className="text-base" /></div>
                      <p className="text-sm font-semibold" style={{ color: "#7d2b13" }}>Clases de hoy</p>
                      <span className="ml-auto text-xs capitalize" style={{ color: "#89726c" }}>{todayEs}</span>
                    </div>
                    {loading ? (
                      <p className="text-sm" style={{ color: "#89726c" }}>Cargando...</p>
                    ) : clasesHoy.length === 0 ? (
                      <p className="text-sm" style={{ color: "#89726c" }}>Hoy no hay clases programadas. 🌿</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {clasesHoy.map(o => (
                          <li key={o.id} className="flex items-center justify-between gap-2 text-sm">
                            <span style={{ color: "#25190f" }}>
                              <span className="font-semibold">{o.ora_inizio.substring(0, 5)}</span>
                              <span style={{ color: "#89726c" }}> · </span>
                              {o.discipline?.nome ?? o.disciplina_id}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: "#fff3e0", color: "#e65100" }}>
                              {o.iscrizione_orari?.length ?? 0} {(o.iscrizione_orari?.length ?? 0) === 1 ? "alumna" : "alumnas"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Interesadas sin convertir */}
                  <button
                    onClick={() => { setKpiDrawer("pendientes"); fetchKpiStudents({ stato: "attesa" }); }}
                    className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border text-left hover:shadow-md transition-shadow flex flex-col"
                    style={{ borderColor: pendingCount > 0 ? "#f5c6a5" : "var(--surface-container-high, #ece0da)" }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-2 rounded-full" style={{ backgroundColor: pendingCount > 0 ? "#fde7e7" : "#e8f5e9", color: pendingCount > 0 ? "#b71c1c" : "#2e7d32" }}>
                        <Icon name={pendingCount > 0 ? "notifications_active" : "task_alt"} className="text-base" />
                      </div>
                      <p className="text-sm font-semibold" style={{ color: "#7d2b13" }}>Interesadas sin convertir</p>
                    </div>
                    {loading ? (
                      <p className="text-sm" style={{ color: "#89726c" }}>Cargando...</p>
                    ) : pendingCount > 0 ? (
                      <>
                        <p className="text-3xl font-bold" style={{ color: "#b71c1c" }}>{pendingCount}</p>
                        <p className="text-xs mt-1" style={{ color: "#89726c" }}>{pendingAmount}€ potencial · pulsa para verlas y contactarlas →</p>
                      </>
                    ) : (
                      <p className="text-sm" style={{ color: "#2e7d32" }}>Sin contactos pendientes. ¡Todo al día! ✅</p>
                    )}
                  </button>

                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">

                {/* Total Alumnos */}
                <button
                  onClick={handleKpiAlumnos}
                  className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-surface-container-high text-left hover:shadow-md transition-shadow flex flex-col justify-between min-h-[140px]"
                >
                  <div className="flex justify-between items-start mb-3">
                    <p className="text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5" style={{ color: "#89726c" }}>Total Alumnos <InfoTip text="Alumnas con plaza: han pagado la matrícula o ya tienen el bono activo. Pulsa la tarjeta para ver el detalle." /></p>
                    <div className="p-2 bg-secondary-container rounded-full text-on-secondary-container">
                      <Icon name="group" className="text-base" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold" style={{ color: "#7d2b13" }}>{loading ? "—" : iscrittiCount}</p>
                  <p className="text-xs mt-2" style={{ color: "#89726c" }}>Alumnas con pago activo →</p>
                </button>

                {/* Facturación Mes */}
                <button
                  onClick={handleKpiFacturacion}
                  className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-surface-container-high text-left hover:shadow-md transition-shadow flex flex-col justify-between min-h-[140px]"
                >
                  <div className="flex justify-between items-start mb-3">
                    <p className="text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5" style={{ color: "#89726c" }}>Facturación Mes <InfoTip text="Dinero cobrado este mes: matrículas y bonos que ya se están cobrando. No incluye lo que está pendiente de pago." /></p>
                    <div className="p-2 bg-primary-container rounded-full text-on-primary-container">
                      <Icon name="euro" className="text-base" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold" style={{ color: "#7d2b13" }}>{loading ? "—" : `${facturacionMes}€`}</p>
                  <p className="text-xs mt-2 flex items-center gap-1" style={{ color: "#89726c" }}>
                    {!loading && facturacionMesAnterior > 0 ? (
                      <>
                        <span>{facturacionMesAnterior}€ mes ant.</span>
                        <span className={`font-semibold ${facturacionMes >= facturacionMesAnterior ? "text-green-600" : "text-red-500"}`}>
                          {facturacionMes >= facturacionMesAnterior ? "+" : ""}
                          {Math.round(((facturacionMes - facturacionMesAnterior) / facturacionMesAnterior) * 100)}%
                        </span>
                      </>
                    ) : <span>Ver quién aporta →</span>}
                  </p>
                </button>

                {/* Interesadas */}
                <button
                  onClick={() => { setKpiDrawer("pendientes"); fetchKpiStudents({ stato: "attesa" }); }}
                  className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-surface-container-high text-left hover:shadow-md transition-shadow flex flex-col justify-between min-h-[140px]"
                >
                  <div className="flex justify-between items-start mb-3">
                    <p className="text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5" style={{ color: "#89726c" }}>Interesadas <InfoTip text="Personas apuntadas que aún no han pagado online (por ejemplo, eligieron pagar en la escuela). Pendientes de convertir." /></p>
                    <div className="p-2 rounded-full" style={{ backgroundColor: "#fff3e0", color: "#e65100" }}>
                      <Icon name="person_search" className="text-base" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold" style={{ color: "#e65100" }}>{loading ? "—" : pendingCount}</p>
                  <p className="text-xs mt-2" style={{ color: "#89726c" }}>
                    {loading ? "—" : pendingCount > 0 ? `${pendingAmount}€ potencial → convertir` : "Sin contactos pendientes"}
                  </p>
                </button>

                {/* Ocupación Media */}
                <button
                  onClick={() => { setKpiDrawer("ocupacion"); setKpiStudentProfile(null); setKpiOcupacionDisciplina(null); }}
                  className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-surface-container-high text-left hover:shadow-md transition-shadow flex flex-col justify-between min-h-[140px]"
                >
                  <div className="flex justify-between items-start mb-3">
                    <p className="text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5" style={{ color: "#89726c" }}>Ocupación Media <InfoTip text="Porcentaje de plazas ocupadas sobre el total de plazas disponibles en las clases." /></p>
                    <div className="p-2 bg-secondary-container rounded-full text-on-secondary-container">
                      <Icon name="monitoring" className="text-base" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold" style={{ color: "#7d2b13" }}>{loading ? "—" : `${ocupacionMedia}%`}</p>
                  <div className="mt-2 h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${ocupacionMedia}%`, backgroundColor: ocupacionMedia > 75 ? "#2e7d32" : "#7d2b13" }} />
                  </div>
                </button>

                {/* Resultado del Mes */}
                <div className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-surface-container-high flex flex-col justify-between min-h-[140px]">
                  <div className="flex justify-between items-start mb-3">
                    <p className="text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5" style={{ color: "#89726c" }}>Resultado Mes <InfoTip text="Lo que queda al restar los costes fijos a la facturación del mes: beneficio (verde) o pérdida (rojo)." /></p>
                    <div className="p-2 bg-secondary-container rounded-full text-on-secondary-container">
                      <Icon name="account_balance" className="text-base" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold" style={{ color: (loading || finanzasLoading) ? "#89726c" : finResultadoMes >= 0 ? "#2e7d32" : "#b71c1c" }}>
                    {(loading || finanzasLoading) ? "—" : `${finResultadoMes >= 0 ? "+" : ""}${finResultadoMes.toLocaleString("es-ES")}€`}
                  </p>
                  <p className="text-xs mt-2" style={{ color: "#89726c" }}>
                    {finanzasLoading ? "—" : `${finCosteMes.toLocaleString("es-ES")}€ costes fijos`}
                  </p>
                </div>

                {/* Nuevas Inscripciones */}
                <div className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-surface-container-high flex flex-col justify-between min-h-[140px]">
                  <div className="flex justify-between items-start mb-3">
                    <p className="text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5" style={{ color: "#89726c" }}>Nuevas Inscripciones <InfoTip text="Altas nuevas registradas este mes (incluye pendientes y pagadas)." /></p>
                    <div className="p-2 bg-primary-container rounded-full text-on-primary-container">
                      <Icon name="person_add" className="text-base" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold" style={{ color: "#7d2b13" }}>{loading ? "—" : nuevasInscripcionesMes}</p>
                  <p className="text-xs mt-2" style={{ color: "#89726c" }}>
                    {new Date().toLocaleDateString("es-ES", { month: "long" })}
                  </p>
                </div>

                {/* Objetivo Alumnos */}
                <div className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-surface-container-high flex flex-col justify-between min-h-[140px]">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5" style={{ color: "#89726c" }}>Objetivo Alumnos <InfoTip text="Número de alumnas que necesitas para cubrir costes y el margen objetivo de este mes del curso." /></p>
                      <p className="text-xs mt-0.5" style={{ color: "#89726c" }}>Mes {schoolYearMes} del curso</p>
                    </div>
                    <div className="p-2 bg-secondary-container rounded-full text-on-secondary-container">
                      <Icon name="group_add" className="text-base" />
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-2">
                    <p className="text-3xl font-bold" style={{ color: "#7d2b13" }}>
                      {loading || objetivoAlumnos === 0 ? "—" : objetivoAlumnos}
                    </p>
                    {objetivoAlumnos > 0 && (
                      <p className="text-xl font-bold shrink-0" style={{ color: objetivoAlumnosProgress >= 100 ? "#2e7d32" : objetivoAlumnosProgress >= 70 ? "#f57c00" : "#b71c1c" }}>
                        {objetivoAlumnosProgress}%
                      </p>
                    )}
                  </div>
                  {objetivoAlumnos > 0 && (
                    <>
                      <div className="mt-2 h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${objetivoAlumnosProgress}%`, backgroundColor: objetivoAlumnosProgress >= 100 ? "#2e7d32" : objetivoAlumnosProgress >= 70 ? "#f57c00" : "#7d2b13" }} />
                      </div>
                      <p className="text-xs mt-1.5" style={{ color: "#89726c" }}>{iscrittiCount} de {objetivoAlumnos} alumnas · ticket medio {Math.round(avgPricePerStudent)}€</p>
                    </>
                  )}
                </div>

                {/* Objetivo Facturación */}
                <div className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-surface-container-high flex flex-col justify-between min-h-[140px] col-span-1 md:col-span-2">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#89726c" }}>Objetivo Facturación</p>
                      <p className="text-xs mt-0.5" style={{ color: "#89726c" }}>+{Math.round(targetMargin * 100)}% sobre costes fijos</p>
                    </div>
                    <div className="p-2 bg-primary-container rounded-full text-on-primary-container">
                      <Icon name="flag" className="text-base" />
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-3xl font-bold" style={{ color: "#7d2b13" }}>
                        {(loading || finanzasLoading || objetivoFacturacion === 0) ? "—" : `${objetivoFacturacion.toLocaleString("es-ES")}€`}
                      </p>
                      <p className="text-xs mt-1" style={{ color: "#89726c" }}>
                        {objetivoFacturacion > 0 ? `${facturacionMes.toLocaleString("es-ES")}€ facturados de ${objetivoFacturacion.toLocaleString("es-ES")}€` : "Configura los costes fijos para calcular el objetivo"}
                      </p>
                    </div>
                    {objetivoFacturacion > 0 && (
                      <p className="text-2xl font-bold shrink-0" style={{ color: objetivoProgress >= 100 ? "#2e7d32" : objetivoProgress >= 70 ? "#f57c00" : "#b71c1c" }}>
                        {objetivoProgress}%
                      </p>
                    )}
                  </div>
                  {objetivoFacturacion > 0 && (
                    <div className="mt-3 h-2 rounded-full bg-surface-container-high overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${objetivoProgress}%`, backgroundColor: objetivoProgress >= 100 ? "#2e7d32" : objetivoProgress >= 70 ? "#f57c00" : "#7d2b13" }} />
                    </div>
                  )}
                </div>

              </div>

              {/* Leyenda de estados */}
              <div className="rounded-[24px] p-5 border" style={{ borderColor: "#dcc1b9", backgroundColor: "#fff8f5" }}>
                <p className="text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: "#89726c" }}>
                  <Icon name="help" className="text-sm" /> Qué significa cada estado
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                  {[
                    { s: "attesa",           desc: "Apuntada, todavía sin pagar." },
                    { s: "matricula_pagada", desc: "Pagó la matrícula; el bono empieza a cobrarse en septiembre." },
                    { s: "activa",           desc: "Bono mensual cobrándose con normalidad." },
                    { s: "pagado",           desc: "Pago confirmado." },
                    { s: "impago",           desc: "Falló el cobro del bono; requiere atención." },
                    { s: "cancelada",        desc: "Inscripción dada de baja (con reembolso si lo hubo)." },
                  ].map(({ s, desc }) => (
                    <div key={s} className="flex items-start gap-2.5">
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0" style={{ backgroundColor: statoInfo(s).bg, color: statoInfo(s).color }}>
                        {statoInfo(s).label}
                      </span>
                      <span className="text-xs leading-relaxed" style={{ color: "#56423d" }}>{desc}</span>
                    </div>
                  ))}
                </div>
              </div>

            </section>
          )}

          {/* ── Sofía ── */}
          {activeSection === "Sofía" && (
            <section className="flex flex-col h-[calc(100vh-120px)]">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-full" style={{ backgroundColor: "#f5e6e0" }}>
                  <span style={{ fontSize: "1.2rem" }}>💎</span>
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: "#7d2b13" }}>Sofía</p>
                  <p className="text-xs" style={{ color: "#89726c" }}>Tu asistente personal del estudio · con acceso a todos tus datos</p>
                </div>
              </div>

              {/* Mensajes */}
              <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-0">
                {sofiaMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                    <span style={{ fontSize: "3rem" }}>💎</span>
                    <div>
                      <p className="font-semibold" style={{ color: "#7d2b13" }}>Hola Andrea, soy Sofía</p>
                      <p className="text-sm mt-1" style={{ color: "#89726c" }}>Conozco todos los datos de tu estudio.<br />Pregúntame lo que necesites.</p>
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center mt-2">
                      {["¿Cómo voy respecto al objetivo?", "¿Qué disciplina rinde peor?", "¿A quién debo contactar esta semana?"].map(s => (
                        <button key={s} onClick={() => { setSofiaInput(s); }} className="text-xs px-3 py-1.5 rounded-full border transition-colors hover:bg-surface-container-high" style={{ borderColor: "#dcc1b9", color: "#7d2b13" }}>{s}</button>
                      ))}
                    </div>
                  </div>
                )}
                {sofiaMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    {m.role === "assistant" && (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center mr-2 shrink-0 mt-0.5" style={{ backgroundColor: "#f5e6e0" }}>
                        <span style={{ fontSize: "0.8rem" }}>💎</span>
                      </div>
                    )}
                    <div
                      className="max-w-[75%] rounded-2xl px-4 py-3 text-sm"
                      style={{
                        backgroundColor: m.role === "user" ? "#7d2b13" : "#fff8f5",
                        color: m.role === "user" ? "#fff" : "#25190f",
                        borderBottomRightRadius: m.role === "user" ? "4px" : undefined,
                        borderBottomLeftRadius: m.role === "assistant" ? "4px" : undefined,
                        border: m.role === "assistant" ? "1px solid #f0e0d8" : undefined,
                      }}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
                {sofiaLoading && (
                  <div className="flex justify-start">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center mr-2 shrink-0" style={{ backgroundColor: "#f5e6e0" }}>
                      <span style={{ fontSize: "0.8rem" }}>💎</span>
                    </div>
                    <div className="rounded-2xl px-4 py-3 text-sm flex gap-1 items-center" style={{ backgroundColor: "#fff8f5", border: "1px solid #f0e0d8", borderBottomLeftRadius: "4px" }}>
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: "#7d2b13", animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: "#7d2b13", animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ backgroundColor: "#7d2b13", animationDelay: "300ms" }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Input */}
              <div className="flex gap-2 items-end">
                <textarea
                  value={sofiaInput}
                  onChange={e => setSofiaInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendSofiaMessage(); } }}
                  placeholder="Escribe tu pregunta..."
                  rows={1}
                  className="flex-1 border rounded-2xl px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2"
                  style={{ borderColor: "#dcc1b9", focusRingColor: "#7d2b13" } as React.CSSProperties}
                />
                <button
                  onClick={sendSofiaMessage}
                  disabled={sofiaLoading || !sofiaInput.trim()}
                  className="p-3 rounded-full transition-all disabled:opacity-40"
                  style={{ backgroundColor: "#7d2b13", color: "#fff" }}
                >
                  <Icon name="send" className="text-base" />
                </button>
              </div>
            </section>
          )}

          {/* ── Costes ── */}
          {activeSection === "Costes" && (
            <section className="space-y-6">

              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <button onClick={() => setShowCostesDrawer(true)} className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-surface-container-high flex flex-col gap-3 text-left hover:shadow-md transition-shadow cursor-pointer">
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#89726c" }}>Coste Total / Mes</p>
                    <div className="p-2 bg-secondary-container rounded-full text-on-secondary-container"><Icon name="receipt_long" className="text-base" /></div>
                  </div>
                  <p className="text-3xl font-bold" style={{ color: "#7d2b13" }}>{costesLoading ? "—" : `${costesTotalMensual.toLocaleString("es-ES")}€`}</p>
                  <p className="text-xs flex items-center gap-1" style={{ color: "#89726c" }}>{costesData.length} partidas · <span style={{ color: "#7d2b13" }}>Gestionar →</span></p>
                </button>

                <div className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-surface-container-high flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#89726c" }}>Coste Total / Año</p>
                    <div className="p-2 bg-secondary-container rounded-full text-on-secondary-container"><Icon name="calendar_month" className="text-base" /></div>
                  </div>
                  <p className="text-3xl font-bold" style={{ color: "#7d2b13" }}>{costesLoading ? "—" : `${costesTotalAnual.toLocaleString("es-ES")}€`}</p>
                  <p className="text-xs" style={{ color: "#89726c" }}>Proyección anual</p>
                </div>

                <div className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-surface-container-high flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#89726c" }}>Mayor Gasto</p>
                    <div className="p-2 bg-secondary-container rounded-full text-on-secondary-container"><Icon name="trending_up" className="text-base" /></div>
                  </div>
                  <p className="text-3xl font-bold" style={{ color: "#7d2b13" }}>{costesLoading ? "—" : costesCategorias[0] ? `${costesCategorias[0][1]}€` : "—"}</p>
                  <p className="text-xs" style={{ color: "#89726c" }}>{costesCategorias[0]?.[0] ?? "—"}</p>
                </div>
              </div>

              {/* Breakdown por categoría */}
              <div className="bg-surface-container-lowest rounded-[24px] p-6 shadow-sm border border-surface-container-high">
                <p className="text-sm font-semibold mb-5" style={{ color: "#7d2b13" }}>Distribución por Categoría</p>
                {costesLoading
                  ? <p className="text-sm" style={{ color: "#89726c" }}>Cargando...</p>
                  : <div className="space-y-4">
                      {costesCategorias.map(([cat, total]) => (
                        <div key={cat}>
                          <div className="flex justify-between items-center text-xs mb-1.5">
                            <span className="flex items-center gap-2" style={{ color: "#25190f" }}>
                              <Icon name={CATEGORIA_ICON[cat] ?? "label"} className="text-base" style={{ color: "#89726c" }} />
                              {cat}
                            </span>
                            <span className="font-semibold" style={{ color: "#7d2b13" }}>
                              {total}€/mes · {((total / costesTotalMensual) * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#f3e6e0" }}>
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${(total / maxCategoriaCost) * 100}%`, backgroundColor: "#7d2b13" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                }
              </div>

              {/* Tabla por categoría — con acciones */}
              {costesCategorias.map(([cat]) => {
                const items = costesData.filter(c => c.categoria === cat);
                const catTotal = items.reduce((s, c) => s + c.importe_mensual, 0);
                const isAddingHere = addingToCategoria === cat;
                return (
                  <div key={cat} className="bg-surface-container-lowest rounded-[24px] shadow-sm border border-surface-container-high overflow-hidden">

                    {/* Header categoría */}
                    <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: "#dcc1b9", backgroundColor: "#fff8f5" }}>
                      <div className="flex items-center gap-2">
                        <Icon name={CATEGORIA_ICON[cat] ?? "label"} className="text-base" style={{ color: "#7d2b13" }} />
                        <p className="text-sm font-semibold" style={{ color: "#7d2b13" }}>{cat}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-sm font-bold" style={{ color: "#7d2b13" }}>{catTotal}€/mes</p>
                        <button
                          onClick={() => { setAddingToCategoria(isAddingHere ? null : cat); setInlineNuevo({ concepto: "", importe_mensual: 0, importe_anual: 0, notas: "" }); setCostesEditId(null); setCostesDeleteId(null); }}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors hover:bg-[#fff1e9]"
                          style={{ borderColor: "#dcc1b9", color: "#7d2b13" }}
                        >
                          <Icon name={isAddingHere ? "remove" : "add"} className="text-sm" />
                          {isAddingHere ? "Cancelar" : "Añadir"}
                        </button>
                      </div>
                    </div>

                    {/* Tabla */}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b" style={{ borderColor: "#f0e0d8" }}>
                          {["Concepto", "Mensual", "Anual", "Notas", ""].map((h, i) => (
                            <th key={i} className="text-left py-2.5 px-4 text-xs uppercase tracking-widest font-semibold" style={{ color: "#89726c" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(c => {
                          const isEditing = costesEditId === c.id;
                          const isDeleting = costesDeleteId === c.id;

                          if (isDeleting) return (
                            <tr key={c.id} className="border-b" style={{ borderColor: "#f0e0d8", backgroundColor: "#fff5f5" }}>
                              <td colSpan={5} className="py-3 px-4">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-sm font-semibold" style={{ color: "#b71c1c" }}>¿Eliminar «{c.concepto}»?</p>
                                  <div className="flex gap-2 shrink-0">
                                    <button onClick={() => setCostesDeleteId(null)} className="px-3 py-1.5 rounded-lg text-xs border" style={{ borderColor: "#dcc1b9", color: "#89726c" }}>Cancelar</button>
                                    <button onClick={() => handleCosteDelete(c.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: "#b71c1c" }}>Sí, eliminar</button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );

                          if (isEditing) return (
                            <tr key={c.id} className="border-b" style={{ borderColor: "#f0e0d8", backgroundColor: "#fff8f5" }}>
                              <td className="py-2 px-4"><input value={costesEditVals.concepto} onChange={e => setCostesEditVals(p => ({ ...p, concepto: e.target.value }))} className="w-full border rounded-lg px-2 py-1.5 text-sm" style={{ borderColor: "#dcc1b9" }} /></td>
                              <td className="py-2 px-4"><input type="number" min={0} value={costesEditVals.importe_mensual} onChange={e => setCostesEditVals(p => ({ ...p, importe_mensual: Number(e.target.value), importe_anual: Number(e.target.value) * 12 }))} className="w-20 border rounded-lg px-2 py-1.5 text-sm" style={{ borderColor: "#dcc1b9" }} /></td>
                              <td className="py-2 px-4"><span className="text-sm font-semibold" style={{ color: "#89726c" }}>{(costesEditVals.importe_mensual * 12).toLocaleString("es-ES")}€</span></td>
                              <td className="py-2 px-4"><input value={costesEditVals.notas} onChange={e => setCostesEditVals(p => ({ ...p, notas: e.target.value }))} className="w-full border rounded-lg px-2 py-1.5 text-sm" style={{ borderColor: "#dcc1b9" }} /></td>
                              <td className="py-2 px-4">
                                <div className="flex gap-1">
                                  <button onClick={() => handleCosteSave(c.id)} className="p-1.5 rounded-lg text-white" style={{ backgroundColor: "#7d2b13" }}><Icon name="check" className="text-sm" /></button>
                                  <button onClick={() => setCostesEditId(null)} className="p-1.5 rounded-lg border" style={{ borderColor: "#dcc1b9", color: "#89726c" }}><Icon name="close" className="text-sm" /></button>
                                </div>
                              </td>
                            </tr>
                          );

                          return (
                            <tr key={c.id} className="border-b hover:bg-[#fff8f5] transition-colors group" style={{ borderColor: "#f0e0d8" }}>
                              <td className="py-3 px-4 font-medium" style={{ color: "#25190f" }}>{c.concepto}</td>
                              <td className="py-3 px-4 font-semibold whitespace-nowrap" style={{ color: "#7d2b13" }}>{c.importe_mensual}€</td>
                              <td className="py-3 px-4 whitespace-nowrap" style={{ color: "#89726c" }}>{c.importe_anual > 0 ? `${c.importe_anual.toLocaleString("es-ES")}€` : "—"}</td>
                              <td className="py-3 px-4 text-xs max-w-[160px] truncate" style={{ color: "#89726c" }}>{c.notas ?? "—"}</td>
                              <td className="py-3 px-4">
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => handleCosteEdit(c)} className="p-1.5 rounded-lg hover:bg-surface-container-high" style={{ color: "#7d2b13" }}><Icon name="edit" className="text-sm" /></button>
                                  <button onClick={() => { setCostesDeleteId(c.id); setCostesEditId(null); setAddingToCategoria(null); }} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#b71c1c" }}><Icon name="delete" className="text-sm" /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Form inline aggiunta */}
                    {isAddingHere && (
                      <div className="border-t px-6 py-5 space-y-3" style={{ borderColor: "#dcc1b9", backgroundColor: "#f9f4f1" }}>
                        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#89726c" }}>Nueva partida en {cat}</p>
                        <input
                          autoFocus
                          placeholder="Concepto *"
                          value={inlineNuevo.concepto}
                          onChange={e => setInlineNuevo(p => ({ ...p, concepto: e.target.value }))}
                          className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white"
                          style={{ borderColor: "#dcc1b9" }}
                        />
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs block mb-1" style={{ color: "#89726c" }}>Mensual (€)</label>
                            <input type="number" min={0} value={inlineNuevo.importe_mensual}
                              onChange={e => setInlineNuevo(p => ({ ...p, importe_mensual: Number(e.target.value), importe_anual: Number(e.target.value) * 12 }))}
                              className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white" style={{ borderColor: "#dcc1b9" }} />
                          </div>
                          <div>
                            <label className="text-xs block mb-1" style={{ color: "#89726c" }}>Anual (€)</label>
                            <div className="w-full border rounded-xl px-3 py-2.5 text-sm bg-surface-container-high font-semibold" style={{ borderColor: "#dcc1b9", color: "#89726c" }}>{(inlineNuevo.importe_mensual * 12).toLocaleString("es-ES")}€</div>
                          </div>
                        </div>
                        <input placeholder="Notas (opcional)" value={inlineNuevo.notas}
                          onChange={e => setInlineNuevo(p => ({ ...p, notas: e.target.value }))}
                          className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white" style={{ borderColor: "#dcc1b9" }} />
                        <div className="flex gap-3">
                          <button onClick={() => setAddingToCategoria(null)} className="flex-1 py-2.5 rounded-full text-sm border" style={{ borderColor: "#dcc1b9", color: "#89726c" }}>Cancelar</button>
                          <button onClick={() => handleInlineNuevoSave(cat)} disabled={!inlineNuevo.concepto.trim()} className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white disabled:opacity-40" style={{ backgroundColor: "#7d2b13" }}>Guardar</button>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}

            </section>
          )}

          {/* ── Ventas ── */}
          {activeSection === "Ventas" && (
            <section className="space-y-6">

              {/* Selector de mes */}
              <div className="flex items-center gap-3">
                <select
                  value={ventasMes}
                  onChange={e => setVentasMes(e.target.value)}
                  className="text-sm rounded-xl border px-3 py-2 bg-white"
                  style={{ borderColor: "#dcc1b9", color: "#7d2b13" }}
                >
                  {mesesOptions.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                </select>
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-surface-container-high flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#89726c" }}>Ingresos Mes</p>
                    <div className="p-2 bg-secondary-container rounded-full text-on-secondary-container"><Icon name="euro" className="text-base" /></div>
                  </div>
                  <p className="text-3xl font-bold" style={{ color: "#7d2b13" }}>{ventasLoading ? "—" : `${ingresosMesV}€`}</p>
                  {ingresosDiff !== null && (
                    <p className="text-xs flex items-center gap-1" style={{ color: ingresosDiff >= 0 ? "#2e7d32" : "#c62828" }}>
                      <Icon name={ingresosDiff >= 0 ? "trending_up" : "trending_down"} className="text-sm" />
                      {ingresosDiff >= 0 ? "+" : ""}{ingresosDiff.toFixed(1)}% vs anterior
                    </p>
                  )}
                </div>

                <div className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-surface-container-high flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#89726c" }}>Mes Anterior</p>
                    <div className="p-2 bg-secondary-container rounded-full text-on-secondary-container"><Icon name="history" className="text-base" /></div>
                  </div>
                  <p className="text-3xl font-bold" style={{ color: "#7d2b13" }}>{ventasLoading ? "—" : `${ingresosMesAntV}€`}</p>
                  <p className="text-xs" style={{ color: "#89726c" }}>Referencia</p>
                </div>

                <div className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-surface-container-high flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#89726c" }}>Inscripciones</p>
                    <div className="p-2 bg-secondary-container rounded-full text-on-secondary-container"><Icon name="person_add" className="text-base" /></div>
                  </div>
                  <p className="text-3xl font-bold" style={{ color: "#7d2b13" }}>{ventasLoading ? "—" : ventasMesFiltradas.length}</p>
                  <p className="text-xs" style={{ color: pendientesCountV > 0 ? "#c62828" : "#89726c" }}>
                    {pendientesCountV > 0 ? `${pendientesCountV} pendiente${pendientesCountV > 1 ? "s" : ""}` : "Todas cobradas"}
                  </p>
                </div>

                <div className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-surface-container-high flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#89726c" }}>Ticket Medio</p>
                    <div className="p-2 bg-secondary-container rounded-full text-on-secondary-container"><Icon name="receipt" className="text-base" /></div>
                  </div>
                  <p className="text-3xl font-bold" style={{ color: "#7d2b13" }}>{ventasLoading ? "—" : `${ticketMedioV.toFixed(0)}€`}</p>
                  <p className="text-xs" style={{ color: "#89726c" }}>Por alumna cobrada</p>
                </div>
              </div>

              {/* Gráfico ingresos */}
              <div className="bg-surface-container-lowest rounded-[24px] p-6 shadow-sm border border-surface-container-high">
                <div className="flex items-center justify-between mb-6">
                  <p className="text-sm font-semibold" style={{ color: "#7d2b13" }}>Evolución de Ingresos</p>
                  <div className="flex rounded-full overflow-hidden border" style={{ borderColor: "#dcc1b9" }}>
                    {(["diario", "semanal"] as const).map(g => (
                      <button key={g} onClick={() => setVentasGranularity(g)}
                        className="px-4 py-1.5 text-xs font-semibold transition-colors"
                        style={{ backgroundColor: ventasGranularity === g ? "#7d2b13" : "transparent", color: ventasGranularity === g ? "#fff" : "#89726c" }}>
                        {g === "diario" ? "Diario" : "Semanal"}
                      </button>
                    ))}
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={ventasChartData} barCategoryGap="35%">
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#89726c" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "#89726c" }} axisLine={false} tickLine={false} width={45} tickFormatter={v => `${v}€`} />
                    <Tooltip formatter={(v) => [`${v}€`, "Ingresos"]} contentStyle={{ borderRadius: 12, border: "1px solid #dcc1b9", fontSize: 12 }} />
                    <Bar dataKey="ingresos" fill="#7d2b13" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Breakdowns */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-surface-container-lowest rounded-[24px] p-6 shadow-sm border border-surface-container-high">
                  <p className="text-sm font-semibold mb-4" style={{ color: "#7d2b13" }}>Por Disciplina</p>
                  {discBreakdown.length === 0
                    ? <p className="text-sm" style={{ color: "#89726c" }}>Sin datos cobrados este mes</p>
                    : <div className="space-y-3">
                        {discBreakdown.map(d => (
                          <div key={d.nombre}>
                            <div className="flex justify-between text-xs mb-1">
                              <span style={{ color: "#25190f" }}>{d.nombre}</span>
                              <span className="font-semibold" style={{ color: "#7d2b13" }}>{d.ingresos}€ · {d.count} alumna{d.count !== 1 ? "s" : ""}</span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#f3e6e0" }}>
                              <div className="h-full rounded-full transition-all" style={{ width: `${(d.ingresos / maxDisc) * 100}%`, backgroundColor: "#7d2b13" }} />
                            </div>
                          </div>
                        ))}
                      </div>
                  }
                </div>

                <div className="bg-surface-container-lowest rounded-[24px] p-6 shadow-sm border border-surface-container-high">
                  <p className="text-sm font-semibold mb-4" style={{ color: "#7d2b13" }}>Por Plan</p>
                  {planBreakdownV.length === 0
                    ? <p className="text-sm" style={{ color: "#89726c" }}>Sin datos cobrados este mes</p>
                    : <div className="space-y-3">
                        {planBreakdownV.map(p => (
                          <div key={p.nombre}>
                            <div className="flex justify-between text-xs mb-1">
                              <span style={{ color: "#25190f" }}>{p.nombre}</span>
                              <span className="font-semibold" style={{ color: "#7d2b13" }}>{p.ingresos}€ · {p.count} alumna{p.count !== 1 ? "s" : ""}</span>
                            </div>
                            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#f3e6e0" }}>
                              <div className="h-full rounded-full transition-all" style={{ width: `${(p.ingresos / maxPlan) * 100}%`, backgroundColor: "#9c4228" }} />
                            </div>
                          </div>
                        ))}
                      </div>
                  }
                </div>
              </div>

              {/* Tabla detalle */}
              <div className="bg-surface-container-lowest rounded-[24px] shadow-sm border border-surface-container-high overflow-hidden">
                <div className="p-6 border-b" style={{ borderColor: "#dcc1b9" }}>
                  <p className="text-sm font-semibold" style={{ color: "#7d2b13" }}>Detalle de Inscripciones</p>
                  <p className="text-xs mt-1" style={{ color: "#89726c" }}>{ventasMesFiltradas.length} inscripción{ventasMesFiltradas.length !== 1 ? "es" : ""} en el período</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b" style={{ borderColor: "#dcc1b9", backgroundColor: "#fff8f5" }}>
                        {["Alumna", "Disciplina", "Plan", "Precio", "Fecha", "Estado"].map(h => (
                          <th key={h} className="text-left py-3 px-4 text-xs uppercase tracking-widest font-semibold" style={{ color: "#89726c" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ventasMesFiltradas.length === 0
                        ? <tr><td colSpan={6} className="py-10 text-center text-sm" style={{ color: "#89726c" }}>Sin inscripciones en este período</td></tr>
                        : ventasMesFiltradas.map(v => {
                            const alumna = v.nome_alumna ? `${v.nome_alumna} ${v.cognome_alumna ?? ""}`.trim() : `${v.nome} ${v.cognome}`.trim();
                            return (
                              <tr key={v.id} className="border-b hover:bg-[#fff8f5] transition-colors" style={{ borderColor: "#f0e0d8" }}>
                                <td className="py-3 px-4 font-medium" style={{ color: "#25190f" }}>{alumna}</td>
                                <td className="py-3 px-4" style={{ color: "#25190f" }}>{v.discipline?.nome ?? "—"}</td>
                                <td className="py-3 px-4" style={{ color: "#25190f" }}>{PLAN_LABEL[v.piano_id] ?? v.piano_id}</td>
                                <td className="py-3 px-4 font-semibold" style={{ color: "#7d2b13" }}>{v.prezzo != null ? `${v.prezzo}€` : "—"}</td>
                                <td className="py-3 px-4 whitespace-nowrap" style={{ color: "#89726c" }}>{new Date(v.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}</td>
                                <td className="py-3 px-4">
                                  {isPaid(v.stato)
                                    ? <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#e8f5e9] text-[#2e7d32] text-xs font-semibold">Cobrado</span>
                                    : <span className="inline-flex items-center px-3 py-1 rounded-full bg-error-container text-on-error-container text-xs font-semibold">Pendiente</span>}
                                </td>
                              </tr>
                            );
                          })
                      }
                    </tbody>
                  </table>
                </div>
              </div>

            </section>
          )}

          {/* ── Finanzas ── */}
          {activeSection === "Finanzas" && (
            <section className="space-y-6">

              {/* KPI Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Resultado neto mes */}
                <div className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-surface-container-high flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5" style={{ color: "#89726c" }}>Resultado Mes <InfoTip text="Beneficio o pérdida de este mes: los ingresos cobrados menos los costes fijos. Verde = ganas, rojo = pierdes." /></p>
                    <div className="p-2 bg-secondary-container rounded-full text-on-secondary-container"><Icon name="account_balance_wallet" className="text-base" /></div>
                  </div>
                  <p className="text-3xl font-bold" style={{ color: finResultadoMes >= 0 ? "#2e7d32" : "#b71c1c" }}>
                    {finanzasLoading ? "—" : `${finResultadoMes >= 0 ? "+" : ""}${finResultadoMes.toLocaleString("es-ES")}€`}
                  </p>
                  {finResultadoDiff !== null && (
                    <p className="text-xs flex items-center gap-1" style={{ color: finResultadoDiff >= 0 ? "#2e7d32" : "#c62828" }}>
                      <Icon name={finResultadoDiff >= 0 ? "trending_up" : "trending_down"} className="text-sm" />
                      {finResultadoDiff >= 0 ? "+" : ""}{finResultadoDiff.toFixed(1)}% vs mes anterior
                    </p>
                  )}
                </div>

                {/* Margen */}
                <div className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-surface-container-high flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5" style={{ color: "#89726c" }}>Margen <InfoTip text="Qué parte de los ingresos del mes es beneficio. Ejemplo: 30% significa que de cada 100€ que entran, 30€ son ganancia." /></p>
                    <div className="p-2 bg-secondary-container rounded-full text-on-secondary-container"><Icon name="percent" className="text-base" /></div>
                  </div>
                  <p className="text-3xl font-bold" style={{ color: finMargen >= 0 ? "#7d2b13" : "#b71c1c" }}>
                    {finanzasLoading ? "—" : `${finMargen.toFixed(1)}%`}
                  </p>
                  <p className="text-xs" style={{ color: "#89726c" }}>Sobre ingresos cobrados</p>
                </div>

                {/* Resultado YTD */}
                <div className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-surface-container-high flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5" style={{ color: "#89726c" }}>Resultado YTD <InfoTip text="Resultado acumulado de todo el año, desde enero hasta hoy (YTD = 'lo que va de año'). Suma de los beneficios/pérdidas de cada mes." /></p>
                    <div className="p-2 bg-secondary-container rounded-full text-on-secondary-container"><Icon name="calendar_today" className="text-base" /></div>
                  </div>
                  <p className="text-3xl font-bold" style={{ color: finResultadoYTD >= 0 ? "#2e7d32" : "#b71c1c" }}>
                    {finanzasLoading ? "—" : `${finResultadoYTD >= 0 ? "+" : ""}${finResultadoYTD.toLocaleString("es-ES")}€`}
                  </p>
                  <p className="text-xs" style={{ color: "#89726c" }}>Acumulado {new Date().getFullYear()}</p>
                </div>

                {/* Costes fijos */}
                <div className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-surface-container-high flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5" style={{ color: "#89726c" }}>Costes Fijos <InfoTip text="Gastos fijos que pagas cada mes (alquiler, luz, seguros, etc.). Los gestionas en la sección Costes." /></p>
                    <div className="p-2 bg-secondary-container rounded-full text-on-secondary-container"><Icon name="receipt_long" className="text-base" /></div>
                  </div>
                  <p className="text-3xl font-bold" style={{ color: "#7d2b13" }}>
                    {finanzasLoading ? "—" : `${finCosteMes.toLocaleString("es-ES")}€`}
                  </p>
                  <p className="text-xs" style={{ color: "#89726c" }}>Estructura mensual</p>
                </div>
              </div>

              {/* Gráfico Ingresos vs Costes — últimos 6 meses */}
              <div className="bg-surface-container-lowest rounded-[24px] p-6 shadow-sm border border-surface-container-high">
                <p className="text-sm font-semibold mb-6 flex items-center gap-1.5" style={{ color: "#7d2b13" }}>Ingresos vs Costes — últimos 6 meses <InfoTip text="Compara mes a mes lo que entra (barras oscuras) con lo que cuesta mantener el estudio (barras claras). Si la oscura es más alta, ese mes ganaste." /></p>
                {finanzasLoading
                  ? <div className="h-52 flex items-center justify-center"><p className="text-sm" style={{ color: "#89726c" }}>Cargando...</p></div>
                  : <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={finChart6} barCategoryGap="30%" barGap={4}>
                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#89726c" }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 11, fill: "#89726c" }} axisLine={false} tickLine={false} width={50} tickFormatter={v => `${v}€`} />
                        <Tooltip formatter={(v, name) => [`${Number(v).toLocaleString("es-ES")}€`, name === "ingresos" ? "Ingresos" : "Costes"]} contentStyle={{ borderRadius: 12, border: "1px solid #dcc1b9", fontSize: 12 }} />
                        <Legend formatter={v => v === "ingresos" ? "Ingresos" : "Costes"} wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                        <ReferenceLine y={0} stroke="#dcc1b9" />
                        <Bar dataKey="ingresos" fill="#7d2b13" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="costes" fill="#dcc1b9" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                }
              </div>

              {/* Tabla P&L mensual */}
              <div className="bg-surface-container-lowest rounded-[24px] shadow-sm border border-surface-container-high overflow-hidden">
                <div className="px-6 py-4 border-b" style={{ borderColor: "#dcc1b9", backgroundColor: "#fff8f5" }}>
                  <p className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "#7d2b13" }}>P&amp;L Mensual — {new Date().getFullYear()} <InfoTip text="P&L (Pérdidas y Ganancias) es la tabla mes a mes: cuánto entró, cuánto costó y qué resultado quedó. Sirve para ver la evolución del negocio durante el año." /></p>
                  <p className="text-xs mt-0.5" style={{ color: "#89726c" }}>Ingresos cobrados vs estructura de costes</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b" style={{ borderColor: "#dcc1b9", backgroundColor: "#fff8f5" }}>
                        {["Mes", "Ingresos", "Costes", "Resultado", "Margen"].map(h => (
                          <th key={h} className="text-left py-3 px-5 text-xs uppercase tracking-widest font-semibold" style={{ color: "#89726c" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {finanzasMensual.filter(m => m.mes.startsWith(String(new Date().getFullYear()))).map(m => {
                        const resultado = m.ingresos - m.costes;
                        const margen = m.ingresos > 0 ? (resultado / m.ingresos) * 100 : null;
                        const esMesActual = m.mes === meseActual;
                        return (
                          <tr key={m.mes} className="border-b transition-colors" style={{ borderColor: "#f0e0d8", backgroundColor: esMesActual ? "#fff8f5" : "transparent" }}>
                            <td className="py-3 px-5 font-medium capitalize" style={{ color: esMesActual ? "#7d2b13" : "#25190f" }}>
                              {new Date(m.mes + "-01").toLocaleDateString("es-ES", { month: "long" })}
                              {esMesActual && <span className="ml-2 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#7d2b13", color: "#fff" }}>Actual</span>}
                            </td>
                            <td className="py-3 px-5 font-semibold" style={{ color: "#25190f" }}>{m.ingresos > 0 ? `${m.ingresos.toLocaleString("es-ES")}€` : "—"}</td>
                            <td className="py-3 px-5" style={{ color: "#89726c" }}>{m.costes.toLocaleString("es-ES")}€</td>
                            <td className="py-3 px-5 font-bold" style={{ color: resultado >= 0 ? "#2e7d32" : "#b71c1c" }}>
                              {m.ingresos > 0 ? `${resultado >= 0 ? "+" : ""}${resultado.toLocaleString("es-ES")}€` : "—"}
                            </td>
                            <td className="py-3 px-5">
                              {margen !== null
                                ? <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: margen >= 0 ? "#e8f5e9" : "#ffebee", color: margen >= 0 ? "#2e7d32" : "#b71c1c" }}>
                                    {margen.toFixed(1)}%
                                  </span>
                                : <span style={{ color: "#89726c" }}>—</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </section>
          )}

          {/* ── Usuarios ── */}
          {/* ── Asistencia ── */}
          {activeSection === "Asistencia" && (() => {
            const clases = clasesDelDia(asistenciaFecha);
            // Lunes–Viernes de la semana del día seleccionado, para saltar de día con un toque.
            const base = new Date(`${asistenciaFecha}T00:00:00`);
            const dow0 = base.getDay();
            const monOffset = dow0 === 0 ? -6 : 1 - dow0;
            const semana = Array.from({ length: 5 }, (_, i) => {
              const d = new Date(base);
              d.setDate(base.getDate() + monOffset + i);
              return d;
            });
            const presentes = asistenciaRoster.filter(a => a.estado === "presente").length;
            const faltas = asistenciaRoster.filter(a => a.estado === "falta").length;
            const justificadas = asistenciaRoster.filter(a => a.estado === "justificada").length;
            const sinMarcar = asistenciaRoster.filter(a => !a.estado).length;
            const ESTADOS = [
              { key: "presente",    label: "Presente", icon: "check",      bg: "#2e7d32", soft: "#e8f5e9", color: "#2e7d32" },
              { key: "falta",       label: "Falta",    icon: "close",      bg: "#b71c1c", soft: "#fde7e7", color: "#b71c1c" },
              { key: "justificada", label: "Justif.",  icon: "event_busy", bg: "#e65100", soft: "#fff3e0", color: "#e65100" },
            ];
            return (
              <section className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-headline-md text-headline-md text-primary">Asistencia</h3>
                    <p className="text-xs mt-0.5" style={{ color: "#89726c" }}>Pasa lista de cada clase</p>
                  </div>
                  <input
                    type="date"
                    value={asistenciaFecha}
                    onChange={e => setAsistenciaFecha(e.target.value)}
                    className="border rounded-full px-4 py-2.5 text-sm focus:outline-none"
                    style={{ borderColor: "#dcc1b9", color: "#25190f" }}
                  />
                </div>

                {/* Días de la semana (el número = clases ese día) */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {semana.map(d => {
                    const val = d.toLocaleDateString("en-CA");
                    const n = clasesDelDia(val).length;
                    const active = val === asistenciaFecha;
                    return (
                      <button
                        key={val}
                        onClick={() => setAsistenciaFecha(val)}
                        className="flex flex-col items-center px-3 py-2 rounded-2xl border min-w-[56px] shrink-0 transition-colors"
                        style={{ backgroundColor: active ? "#7d2b13" : "#fff", borderColor: active ? "#7d2b13" : "#dcc1b9", color: active ? "#fff" : "#25190f" }}
                      >
                        <span className="text-[10px] uppercase tracking-wide" style={{ color: active ? "#fff" : "#89726c" }}>{DAYS_SHORT_ES[d.getDay()]}</span>
                        <span className="text-base font-bold leading-tight">{d.getDate()}</span>
                        {n > 0
                          ? <span className="text-[10px] mt-0.5 px-1.5 rounded-full font-semibold" style={{ backgroundColor: active ? "rgba(255,255,255,.25)" : "#fff3e0", color: active ? "#fff" : "#e65100" }}>{n}</span>
                          : <span className="text-[10px] mt-0.5" style={{ color: active ? "rgba(255,255,255,.55)" : "#cbb8b0" }}>—</span>}
                      </button>
                    );
                  })}
                </div>

                {clases.length === 0 ? (
                  <div className="rounded-[24px] p-8 text-center border" style={{ borderColor: "#dcc1b9", backgroundColor: "#fff8f5" }}>
                    <p className="text-sm" style={{ color: "#89726c" }}>No hay clases este día. Elige arriba un día con número 👆 (ahí están tus clases y alumnas).</p>
                  </div>
                ) : (
                  <>
                    {/* Selector de clase */}
                    <div className="flex flex-wrap gap-2">
                      {clases.map(c => {
                        const active = c.id === asistenciaOrarioId;
                        return (
                          <button
                            key={c.id}
                            onClick={() => { setAsistenciaOrarioId(c.id); cargarRoster(c.id, asistenciaFecha); }}
                            className="px-4 py-2 rounded-full text-sm font-semibold transition-colors border"
                            style={{ backgroundColor: active ? "#7d2b13" : "#fff", color: active ? "#fff" : "#7d2b13", borderColor: active ? "#7d2b13" : "#dcc1b9" }}
                          >
                            {c.ora_inizio.substring(0, 5)} · {c.discipline?.nome ?? c.disciplina_id}
                          </button>
                        );
                      })}
                    </div>

                    {asistenciaLoading ? (
                      <div className="flex items-center justify-center h-40">
                        <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#7d2b13", borderTopColor: "transparent" }} />
                      </div>
                    ) : asistenciaRoster.length === 0 ? (
                      <div className="rounded-[24px] p-8 text-center border" style={{ borderColor: "#dcc1b9", backgroundColor: "#fff8f5" }}>
                        <p className="text-sm" style={{ color: "#89726c" }}>No hay alumnas inscritas en esta clase.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs" style={{ color: "#89726c" }}>
                            <span style={{ color: "#2e7d32", fontWeight: 600 }}>{presentes} presentes</span>
                            {" · "}<span style={{ color: "#b71c1c" }}>{faltas} faltas</span>
                            {" · "}<span style={{ color: "#e65100" }}>{justificadas} justif.</span>
                            {sinMarcar > 0 && <> · {sinMarcar} sin marcar</>}
                          </p>
                          <button
                            onClick={marcarTodasPresentes}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border"
                            style={{ borderColor: "#2e7d32", color: "#2e7d32" }}
                          >
                            <Icon name="done_all" className="text-sm" /> Todas presentes
                          </button>
                        </div>

                        <div className="bg-surface-container-lowest rounded-[24px] shadow-sm border border-surface-container-high overflow-hidden divide-y" style={{ borderColor: "#dcc1b9" }}>
                          {asistenciaRoster.map(a => (
                            <div key={a.iscrizione_id} className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderColor: "#f0e0d8" }}>
                              <span className="text-sm font-medium truncate" style={{ color: "#25190f" }}>{a.nombre}</span>
                              <div className="flex gap-1.5 shrink-0">
                                {ESTADOS.map(es => {
                                  const active = a.estado === es.key;
                                  return (
                                    <button
                                      key={es.key}
                                      onClick={() => marcarAsistencia(a.iscrizione_id, es.key)}
                                      title={es.label}
                                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-colors border"
                                      style={{
                                        backgroundColor: active ? es.bg : es.soft,
                                        color: active ? "#fff" : es.color,
                                        borderColor: active ? es.bg : "transparent",
                                      }}
                                    >
                                      <Icon name={es.icon} className="text-sm" />
                                      <span className="hidden sm:inline">{es.label}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </section>
            );
          })()}

          {activeSection === "Usuarios" && (() => {
            const q = usuariosSearch.toLowerCase();
            // Disciplinas presentes en las alumnas, para el selector de filtro.
            const discOptions = [...new Map(usuariosData.map(u => [u.disciplina_id, u.discipline?.nome ?? u.disciplina_id])).entries()]
              .sort((a, b) => a[1].localeCompare(b[1]));
            // Estados realmente presentes en los datos, para no ofrecer filtros vacíos.
            const statoOptions = [...new Set(usuariosData.map(u => u.stato))].sort();
            const filtered = usuariosData.filter(u => {
              if (usuariosFiltroDisc && u.disciplina_id !== usuariosFiltroDisc) return false;
              if (usuariosFiltroStato && u.stato !== usuariosFiltroStato) return false;
              if (!q) return true;
              const name = NINAS_IDS.has(u.disciplina_id) && u.nome_alumna
                ? `${u.nome_alumna} ${u.cognome_alumna ?? ""}`.toLowerCase()
                : `${u.nome} ${u.cognome}`.toLowerCase();
              return name.includes(q) || (u.discipline?.nome ?? "").toLowerCase().includes(q);
            });
            const filtrosActivos = usuariosFiltroDisc !== "" || usuariosFiltroStato !== "" || q !== "";
            return (
              <section className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-headline-md text-headline-md text-primary">Usuarios</h3>
                    <p className="text-xs mt-0.5" style={{ color: "#89726c" }}>
                      {usuariosLoading
                        ? "Cargando..."
                        : filtrosActivos
                          ? `${filtered.length} de ${usuariosData.length} alumna${usuariosData.length !== 1 ? "s" : ""}`
                          : `${usuariosData.length} alumna${usuariosData.length !== 1 ? "s" : ""} registradas`}
                    </p>
                  </div>
                  <div className="relative w-full md:w-72">
                    <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-base pointer-events-none" style={{ color: "#89726c" }} />
                    <input
                      value={usuariosSearch}
                      onChange={e => setUsuariosSearch(e.target.value)}
                      placeholder="Buscar por nombre o disciplina..."
                      className="w-full border rounded-full pl-9 pr-4 py-2.5 text-sm focus:outline-none"
                      style={{ borderColor: "#dcc1b9", color: "#25190f" }}
                    />
                  </div>
                </div>

                {/* Filtros */}
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={usuariosFiltroDisc}
                    onChange={e => setUsuariosFiltroDisc(e.target.value)}
                    className="border rounded-full px-4 py-2 text-sm focus:outline-none cursor-pointer"
                    style={{ borderColor: "#dcc1b9", color: usuariosFiltroDisc ? "#25190f" : "#89726c", backgroundColor: usuariosFiltroDisc ? "#fff3e0" : "#fff" }}
                  >
                    <option value="">Todas las disciplinas</option>
                    {discOptions.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
                  </select>
                  <select
                    value={usuariosFiltroStato}
                    onChange={e => setUsuariosFiltroStato(e.target.value)}
                    className="border rounded-full px-4 py-2 text-sm focus:outline-none cursor-pointer"
                    style={{ borderColor: "#dcc1b9", color: usuariosFiltroStato ? "#25190f" : "#89726c", backgroundColor: usuariosFiltroStato ? "#fff3e0" : "#fff" }}
                  >
                    <option value="">Todos los estados</option>
                    {statoOptions.map(s => <option key={s} value={s}>{statoInfo(s).label}</option>)}
                  </select>
                  {filtrosActivos && (
                    <button
                      onClick={() => { setUsuariosSearch(""); setUsuariosFiltroDisc(""); setUsuariosFiltroStato(""); }}
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-xs font-semibold"
                      style={{ color: "#7d2b13" }}
                    >
                      <Icon name="close" className="text-sm" /> Limpiar filtros
                    </button>
                  )}
                </div>

                {usuariosLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#7d2b13", borderTopColor: "transparent" }} />
                  </div>
                ) : (
                  <div className="bg-surface-container-lowest rounded-[24px] shadow-sm border border-surface-container-high overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[640px]">
                        <thead>
                          <tr className="border-b" style={{ borderColor: "#dcc1b9", backgroundColor: "#fff8f5" }}>
                            {["Alumna", "Tutor", "Disciplina", "Plan", "Cuota", "Estado", "Inscrita", ""].map((h, hi) => (
                              <th key={hi} className="text-left py-3 px-4 text-xs uppercase tracking-widest font-semibold" style={{ color: "#89726c" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.length === 0 ? (
                            <tr><td colSpan={8} className="py-12 text-center text-sm" style={{ color: "#89726c" }}>No hay resultados</td></tr>
                          ) : filtered.map(u => {
                            const esNina = NINAS_IDS.has(u.disciplina_id);
                            const alumnaName = esNina && u.nome_alumna
                              ? `${u.nome_alumna} ${u.cognome_alumna ?? ""}`.trim()
                              : `${u.nome} ${u.cognome}`;
                            const tutorName = esNina && u.nome_alumna ? `${u.nome} ${u.cognome}` : null;
                            return (
                              <tr
                                key={u.id}
                                onClick={() => handleUsuarioClick(u.id)}
                                className="border-b hover:bg-[#fff8f5] transition-colors cursor-pointer"
                                style={{ borderColor: "#f0e0d8" }}
                              >
                                <td className="py-3 px-4 font-medium" style={{ color: "#25190f" }}>{alumnaName}</td>
                                <td className="py-3 px-4 text-xs" style={{ color: "#89726c" }}>{tutorName ?? "—"}</td>
                                <td className="py-3 px-4" style={{ color: "#25190f" }}>{u.discipline?.nome ?? "—"}</td>
                                <td className="py-3 px-4" style={{ color: "#25190f" }}>{PLAN_LABEL[u.piano_id] ?? u.piano_id}</td>
                                <td className="py-3 px-4 font-semibold whitespace-nowrap" style={{ color: "#7d2b13" }}>{u.prezzo != null ? `${u.prezzo}€/mes` : "—"}</td>
                                <td className="py-3 px-4">
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap" style={{ backgroundColor: statoInfo(u.stato).bg, color: statoInfo(u.stato).color }}>
                                    {statoInfo(u.stato).label}
                                  </span>
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap text-xs" style={{ color: "#89726c" }}>
                                  {new Date(u.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                                </td>
                                <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                  {rowDeleteId === u.id ? (
                                    <span className="inline-flex items-center gap-1.5">
                                      <button onClick={() => handleEliminarRow(u.id, u.stato, u.prezzo, null)} disabled={rowDeleting} className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: "#b71c1c", color: "#fff" }}>{rowDeleting ? "..." : "Sí, borrar"}</button>
                                      <button onClick={() => setRowDeleteId(null)} className="px-2.5 py-1 rounded-full text-xs" style={{ backgroundColor: "#f0ddd5", color: "#56423d" }}>No</button>
                                    </span>
                                  ) : (
                                    <button onClick={() => setRowDeleteId(u.id)} className="p-1.5 rounded-lg hover:bg-[#fbe9e7] transition-colors" aria-label="Eliminar" title="Eliminar">
                                      <Icon name="delete" className="text-base" style={{ color: "#b71c1c" }} />
                                    </button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            );
          })()}

          {/* ── Puertas Abiertas ── */}
          {activeSection === "Puertas Abiertas" && (() => {
            const DISC_LABEL: Record<string, string> = {
              "ballet-nina": "Ballet Niña",
              "ballet-adultas": "Ballet Adultas",
              "barre": "Barre",
              "pilates-mat": "Pilates Mat",
            };
            // Construye un enlace wa.me normalizando el teléfono a formato internacional
            // español (sin +, espacios ni símbolos) y con un mensaje ya redactado.
            const waLink = (r: PuertaRow) => {
              let tel = (r.telefono || "").replace(/\D/g, "");
              if (tel.startsWith("00")) tel = tel.slice(2);
              if (tel.length === 9) tel = "34" + tel; // móvil español sin prefijo
              const grupo = "https://chat.whatsapp.com/GvefZIztp0G5Wb3gif5f2g";
              const msg =
                `¡Hola ${r.nombre}! Soy Andrea, de Andrea Carrió Studio. ` +
                `Gracias por reservar tu plaza en la Jornada de Puertas Abiertas del 24 de julio. ` +
                `Te dejo el enlace del grupo de WhatsApp donde comparto todos los detalles, por si no llegaste a unirte: ${grupo}`;
              return `https://wa.me/${tel}?text=${encodeURIComponent(msg)}`;
            };
            const q = puertasSearch.toLowerCase();
            const filtered = puertasData.filter(r =>
              !q ||
              `${r.nombre} ${r.apellido}`.toLowerCase().includes(q) ||
              r.email.toLowerCase().includes(q) ||
              r.telefono.includes(q)
            );
            const conAlergias = puertasData.filter(r => r.alergias).length;
            const conNinas = puertasData.filter(r => r.ninas?.length > 0).length;
            return (
              <section className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-headline-md text-headline-md text-primary">Puertas Abiertas</h3>
                    <p className="text-sm mt-0.5" style={{ color: "#89726c" }}>
                      {puertasData.length} {puertasData.length === 1 ? "reserva" : "reservas"} recibidas
                    </p>
                  </div>
                  <a
                    href="/puertas-abiertas"
                    target="_blank"
                    className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest px-4 py-2 rounded-full border transition-colors hover:bg-surface-container-high"
                    style={{ borderColor: "#dcc1b9", color: "#7d2b13" }}
                  >
                    <Icon name="open_in_new" className="text-sm" />
                    Ver página pública
                  </a>
                </div>

                {/* KPIs rápidos */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total inscritas", value: puertasData.length, icon: "groups" },
                    { label: "Con alergias", value: conAlergias, icon: "medical_information" },
                    { label: "Traen niña", value: conNinas, icon: "child_care" },
                  ].map(k => (
                    <div key={k.label} className="rounded-2xl p-4 text-center" style={{ backgroundColor: "#fff8f5", border: "1px solid #dcc1b9" }}>
                      <Icon name={k.icon} className="text-xl mb-1" style={{ color: "#7d2b13" }} />
                      <p className="text-2xl font-bold" style={{ color: "#7d2b13" }}>{puertasLoading ? "—" : k.value}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#89726c" }}>{k.label}</p>
                    </div>
                  ))}
                </div>

                {/* Buscador */}
                <div className="relative">
                  <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "#89726c" }} />
                  <input
                    value={puertasSearch}
                    onChange={e => setPuertasSearch(e.target.value)}
                    placeholder="Buscar por nombre, email o teléfono..."
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm"
                    style={{ borderColor: "#dcc1b9", backgroundColor: "#fff8f5", color: "#25190f" }}
                  />
                </div>

                {/* Tabla */}
                <div className="rounded-2xl overflow-hidden border" style={{ borderColor: "#dcc1b9" }}>
                  {puertasLoading ? (
                    <div className="p-8 text-center text-sm" style={{ color: "#89726c" }}>Cargando...</div>
                  ) : filtered.length === 0 ? (
                    <div className="p-8 text-center">
                      <Icon name="celebration" className="text-4xl mb-3" style={{ color: "#dcc1b9" }} />
                      <p className="text-sm" style={{ color: "#89726c" }}>
                        {puertasSearch ? "Sin resultados para esa búsqueda." : "Aún no hay reservas. Comparte el enlace para empezar a recibir inscripciones."}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ backgroundColor: "#fff0eb" }}>
                            {["Nombre", "Contacto", "Quiere probar", "Niñas", "Alergias", "Origen", "Fecha", ""].map((h, hi) => (
                              <th key={hi} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-widest" style={{ color: "#89726c" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((r, i) => (
                            <tr key={r.id} style={{ borderTop: "1px solid #f0ddd5", backgroundColor: i % 2 === 0 ? "#ffffff" : "#fffbf9" }}>
                              <td className="px-4 py-3 font-medium" style={{ color: "#25190f" }}>
                                {r.nombre} {r.apellido}
                              </td>
                              <td className="px-4 py-3">
                                <p style={{ color: "#25190f" }}>{r.email}</p>
                                <p className="text-xs mt-0.5" style={{ color: "#89726c" }}>{r.telefono}</p>
                                <a
                                  href={waLink(r)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-xs font-semibold text-white hover:opacity-90 transition-opacity"
                                  style={{ backgroundColor: "#25D366" }}
                                  title="Escribir por WhatsApp"
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <path d="M.057 24l1.687-6.163a11.867 11.867 0 0 1-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 0 1 8.413 3.488 11.824 11.824 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 0 0 1.51 5.26l-.999 3.648 3.477-1.717zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413z"/>
                                  </svg>
                                  WhatsApp
                                </a>
                              </td>
                              <td className="px-4 py-3">
                                {r.disciplina_adulta ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: "#ffdbd1", color: "#7d2b13" }}>
                                    {DISC_LABEL[r.disciplina_adulta] ?? r.disciplina_adulta}
                                  </span>
                                ) : <span style={{ color: "#89726c" }}>—</span>}
                              </td>
                              <td className="px-4 py-3">
                                {r.ninas?.length > 0 ? (
                                  <div className="space-y-0.5">
                                    {r.ninas.map((n, ni) => (
                                      <p key={ni} className="text-xs" style={{ color: "#56423d" }}>
                                        {n.nombre} <span style={{ color: "#89726c" }}>({n.edad})</span>
                                      </p>
                                    ))}
                                  </div>
                                ) : <span style={{ color: "#89726c" }}>—</span>}
                              </td>
                              <td className="px-4 py-3 max-w-[180px]">
                                {r.alergias ? (
                                  <span className="flex items-start gap-1.5">
                                    <Icon name="warning" className="text-xs mt-0.5 flex-shrink-0" style={{ color: "#e65100" }} />
                                    <span className="text-xs leading-snug" style={{ color: "#56423d" }}>{r.alergias}</span>
                                  </span>
                                ) : (
                                  <span className="text-xs" style={{ color: "#89726c" }}>Sin alergias</span>
                                )}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                {(() => {
                                  const styles: Record<string, { label: string; bg: string; fg: string }> = {
                                    ads: { label: "Publicidad", bg: "#e6efff", fg: "#1b4f9c" },
                                    escuela: { label: "Escuela", bg: "#e7f7ec", fg: "#1f7a3d" },
                                    directo: { label: "Directo", bg: "#f0eae6", fg: "#6b5a52" },
                                  };
                                  const key = (r.origen || "directo").toLowerCase();
                                  const s = styles[key] ?? { label: r.origen ?? "Directo", bg: "#f0eae6", fg: "#6b5a52" };
                                  return (
                                    <span className="flex flex-col gap-0.5">
                                      <span className="inline-flex items-center self-start px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: s.bg, color: s.fg }}>
                                        {s.label}
                                      </span>
                                      {r.utm_campaign ? (
                                        <span className="text-[10px]" style={{ color: "#89726c" }}>{r.utm_campaign}</span>
                                      ) : null}
                                    </span>
                                  );
                                })()}
                              </td>
                              <td className="px-4 py-3 text-xs whitespace-nowrap" style={{ color: "#89726c" }}>
                                {new Date(r.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                {puertasDeleteId === r.id ? (
                                  <span className="inline-flex items-center gap-1.5">
                                    <button
                                      onClick={() => handleDeletePuerta(r.id)}
                                      className="px-2.5 py-1 rounded-full text-xs font-semibold"
                                      style={{ backgroundColor: "#b3261e", color: "#fff" }}
                                    >
                                      Sí, borrar
                                    </button>
                                    <button
                                      onClick={() => setPuertasDeleteId(null)}
                                      className="px-2.5 py-1 rounded-full text-xs"
                                      style={{ backgroundColor: "#f0ddd5", color: "#56423d" }}
                                    >
                                      No
                                    </button>
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => setPuertasDeleteId(r.id)}
                                    className="p-1.5 rounded-lg hover:bg-[#fbe9e7] transition-colors"
                                    aria-label="Borrar reserva"
                                    title="Borrar reserva"
                                  >
                                    <Icon name="delete" className="text-base" style={{ color: "#b3261e" }} />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            );
          })()}

          {/* ── Calendario ── */}
          {activeSection === "Calendario" && <>

          {/* ── Calendario ── */}
          <section>
            <h3 className="font-headline-md text-headline-md text-primary mb-stack-md">
              Calendario Semanal
            </h3>
            <div className="bg-surface-container-lowest rounded-[24px] p-4 md:p-6 shadow-sm shadow-[#3D2B1F]/5 border border-surface-container-high">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div
                    className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: "#7d2b13", borderTopColor: "transparent" }}
                  />
                </div>
              ) : (
                <>
                  {/* ── Vista mobile: lista vertical por día ── */}
                  <div className="md:hidden space-y-5">
                    {times.length === 0 ? (
                      <p className="text-center text-on-surface-variant py-8">No hay horarios configurados</p>
                    ) : (
                      GIORNI.map((giorno, i) => {
                        const date = weekDates[i];
                        const isToday = date.toDateString() === new Date().toDateString();
                        const slots = orari
                          .filter((o) => o.giorno === giorno)
                          .sort((a, b) => a.ora_inizio.localeCompare(b.ora_inizio));
                        if (slots.length === 0) return null;
                        return (
                          <div key={giorno}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`text-sm font-semibold ${isToday ? "text-primary" : "text-on-surface-variant"}`}>
                                {giorno} {date.getDate()}
                              </span>
                              {isToday && (
                                <span className="text-xs bg-primary text-on-primary px-2 py-0.5 rounded-full">Hoy</span>
                              )}
                            </div>
                            <div className="space-y-2">
                              {slots.map((o) => {
                                const ocupados = o.iscrizione_orari?.length ?? 0;
                                const lleno = ocupados >= o.posti_totali;
                                return (
                                  <div
                                    key={o.id}
                                    onClick={() => handleOrarioClick(o)}
                                    className={`${getDcClasses(o.disciplina_id)} rounded-xl p-3 flex justify-between items-center cursor-pointer hover:shadow-md transition-shadow`}
                                  >
                                    <div>
                                      <p className="text-sm font-medium text-on-surface">
                                        {o.discipline?.nome ?? o.disciplina_id}
                                      </p>
                                      <p className="text-xs text-on-surface-variant mt-0.5">
                                        {o.ora_inizio.substring(0, 5)} – {o.ora_fine.substring(0, 5)}
                                      </p>
                                    </div>
                                    <p className={`text-sm font-bold ${lleno ? "text-error" : "text-on-surface-variant"}`}>
                                      {ocupados}/{o.posti_totali}
                                    </p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* ── Vista desktop: grilla semanal ── */}
                  <div className="hidden md:block overflow-x-auto">
                    <div className="min-w-[800px]">
                      {/* Header */}
                      <div className="grid grid-cols-6 gap-4 mb-4 border-b border-outline-variant pb-4">
                        <div className="font-label-md text-label-md text-on-surface-variant text-center">Horario</div>
                        {weekDates.map((d, i) => {
                          const isToday = d.toDateString() === new Date().toDateString();
                          return (
                            <div
                              key={i}
                              className={`font-label-md text-label-md text-center ${
                                isToday ? "text-primary font-bold" : "text-on-surface-variant"
                              }`}
                            >
                              {DAYS_SHORT_ES[d.getDay()]} {d.getDate()}
                            </div>
                          );
                        })}
                      </div>
                      {/* Rows */}
                      <div className="space-y-4">
                        {times.length === 0 ? (
                          <p className="text-center text-on-surface-variant py-8">No hay horarios configurados</p>
                        ) : (
                          times.map((time, ti) => (
                            <div
                              key={time}
                              className={`grid grid-cols-6 gap-4 items-center ${
                                ti > 0 ? "border-t border-outline-variant/50 pt-4" : ""
                              }`}
                            >
                              <div className="font-body-md text-body-md text-on-surface-variant text-center">{time}</div>
                              {GIORNI.map((giorno) => {
                                const o = grid[time]?.[giorno];
                                if (!o) return <div key={giorno} />;
                                return (
                                  <div
                                    key={giorno}
                                    onClick={() => handleOrarioClick(o)}
                                    className={`${getDcClasses(o.disciplina_id)} rounded-lg p-3 text-center hover:shadow-md transition-shadow cursor-pointer`}
                                  >
                                    <p className="font-label-md text-label-md text-on-surface">
                                      {o.discipline?.nome ?? o.disciplina_id}
                                    </p>
                                    <p className="font-body-md text-body-md text-on-surface-variant text-xs mt-1">
                                      {time} – {o.ora_fine.substring(0, 5)}
                                    </p>
                                    {(() => {
                                      const ocupados = o.iscrizione_orari?.length ?? 0;
                                      const lleno = ocupados >= o.posti_totali;
                                      return (
                                        <p className={`text-xs font-semibold mt-1.5 ${lleno ? "text-error" : "text-on-surface-variant"}`}>
                                          {ocupados}/{o.posti_totali} inscritos
                                        </p>
                                      );
                                    })()}
                                  </div>
                                );
                              })}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* ── Prenotazioni recenti ── */}
          <section>
            <div className="flex justify-between items-center mb-stack-md">
              <h3 className="font-headline-md text-headline-md text-primary">Reservas Recientes</h3>
              <button className="font-label-md text-label-md text-secondary hover:text-primary transition-colors flex items-center">
                Ver todas <Icon name="arrow_forward" className="ml-1 text-sm" />
              </button>
            </div>
            <div className="bg-surface-container-lowest rounded-[24px] shadow-sm shadow-[#3D2B1F]/5 border border-surface-container-high overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[680px]">
                <thead className="bg-surface-container-low border-b border-outline-variant">
                  <tr>
                    <th className="py-4 px-4 md:px-6 font-label-md text-label-md text-on-surface-variant">Usuario</th>
                    <th className="py-4 px-4 md:px-6 font-label-md text-label-md text-on-surface-variant">Disciplina</th>
                    <th className="py-4 px-4 md:px-6 font-label-md text-label-md text-on-surface-variant">Horario</th>
                    <th className="py-4 px-4 md:px-6 font-label-md text-label-md text-on-surface-variant">Fecha</th>
                    <th className="py-4 px-4 md:px-6 font-label-md text-label-md text-on-surface-variant">Estado</th>
                    <th className="py-4 px-4 md:px-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/50">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-on-surface-variant">Cargando...</td>
                    </tr>
                  ) : bookings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-on-surface-variant font-body-md text-body-md">
                        No hay reservas aún
                      </td>
                    </tr>
                  ) : (
                    bookings.map((b) => (
                      <tr key={b.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="py-4 px-4 md:px-6 font-body-md text-body-md text-on-surface">
                          {b.nome_alumna ? (
                            <>
                              <span className="flex items-center gap-1.5 font-medium">
                                <Icon name="child_care" className="text-sm" style={{ color: "#7d2b13" }} />
                                {b.nome_alumna} {b.cognome_alumna}
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide" style={{ backgroundColor: "#f3e1d9", color: "#7d2b13" }}>
                                  Hija
                                </span>
                              </span>
                              <span className="block text-xs mt-0.5" style={{ color: "#89726c" }}>
                                Tutor/a: {b.nome} {b.cognome}
                              </span>
                            </>
                          ) : (
                            <span className="font-medium">{b.nome} {b.cognome}</span>
                          )}
                        </td>
                        <td className="py-4 px-4 md:px-6 font-body-md text-body-md text-on-surface">
                          {b.discipline?.nome ?? "—"}
                        </td>
                        <td className="py-4 px-4 md:px-6 font-body-md text-body-md text-on-surface whitespace-nowrap">
                          {formatHorarios(b.iscrizione_orari)}
                        </td>
                        <td className="py-4 px-4 md:px-6 font-body-md text-body-md text-on-surface-variant whitespace-nowrap">
                          {formatData(b.created_at)}
                        </td>
                        <td className="py-4 px-4 md:px-6">
                          {b.stato === "attesa" ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-error-container text-on-error-container font-label-md text-xs whitespace-nowrap">
                              Pendiente
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#e8f5e9] text-[#2e7d32] font-label-md text-xs">
                              Pagado
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 md:px-6 text-right whitespace-nowrap">
                          {rowDeleteId === b.id ? (
                            <span className="inline-flex items-center gap-1.5">
                              <button onClick={() => handleEliminarRow(b.id, b.stato, null, null)} disabled={rowDeleting} className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: "#b71c1c", color: "#fff" }}>{rowDeleting ? "..." : "Sí, borrar"}</button>
                              <button onClick={() => setRowDeleteId(null)} className="px-2.5 py-1 rounded-full text-xs" style={{ backgroundColor: "#f0ddd5", color: "#56423d" }}>No</button>
                            </span>
                          ) : (
                            <button onClick={() => setRowDeleteId(b.id)} className="p-1.5 rounded-lg hover:bg-[#fbe9e7] transition-colors" aria-label="Eliminar" title="Eliminar">
                              <Icon name="delete" className="text-base" style={{ color: "#b71c1c" }} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              </div>
            </div>
          </section>

          </>}

        </main>
      </div>

      {/* ── KPI Drawer ── */}
      {kpiDrawer && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[60]" onClick={() => setKpiDrawer(null)} />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white z-[70] flex flex-col shadow-2xl">

            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-outline-variant" style={{ backgroundColor: "#fff8f5" }}>
              {(kpiStudentProfile || kpiOcupacionDisciplina || kpiAlumnosDisciplina) && (
                <button
                  onClick={() => {
                    if (kpiStudentProfile) { setKpiStudentProfile(null); }
                    else if (kpiOcupacionDisciplina) { setKpiOcupacionDisciplina(null); }
                    else if (kpiAlumnosDisciplina) { setKpiAlumnosDisciplina(null); setKpiStudents([]); }
                  }}
                  className="p-2 rounded-full hover:bg-surface-container-high transition-colors"
                  style={{ color: "#7d2b13" }}
                >
                  <Icon name="arrow_back" />
                </button>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate" style={{ color: "#7d2b13" }}>
                  {kpiStudentProfile
                    ? (NINAS_IDS.has(kpiStudentProfile.disciplina_id) && kpiStudentProfile.nome_alumna
                      ? `${kpiStudentProfile.nome_alumna} ${kpiStudentProfile.cognome_alumna}`
                      : `${kpiStudentProfile.nome} ${kpiStudentProfile.cognome}`)
                    : kpiOcupacionDisciplina ? kpiOcupacionDisciplina.nombre
                    : kpiDrawer === "alumnos" && kpiAlumnosDisciplina ? kpiAlumnosDisciplina.nombre
                    : kpiDrawer === "pendientes" ? "Interesadas sin pagar"
                    : kpiDrawer === "facturacion" ? "Facturación del mes"
                    : kpiDrawer === "alumnos" ? "Alumnas Activas"
                    : "Ocupación por Disciplina"}
                </p>
                <p className="text-xs" style={{ color: "#89726c" }}>
                  {kpiStudentProfile ? "Perfil"
                    : kpiOcupacionDisciplina ? "Clases"
                    : kpiDrawer === "pendientes" ? `${pendingCount} contacto${pendingCount !== 1 ? "s" : ""} · ${pendingAmount}€ potencial`
                    : kpiDrawer === "alumnos" && kpiAlumnosDisciplina ? `${kpiStudents.length} alumna${kpiStudents.length !== 1 ? "s" : ""}`
                    : kpiDrawer === "alumnos" ? `${iscrittiCount} alumna${iscrittiCount !== 1 ? "s" : ""} activas`
                    : kpiDrawer === "facturacion" ? `${facturacionMes}€ · ${kpiStudents.length} alumna${kpiStudents.length !== 1 ? "s" : ""}`
                    : `${ocupacionMedia}% media`}
                </p>
              </div>
              <button onClick={() => setKpiDrawer(null)} className="p-2 rounded-full hover:bg-surface-container-high" style={{ color: "#89726c" }}>
                <Icon name="close" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {kpiLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#7d2b13", borderTopColor: "transparent" }} />
                </div>

              ) : kpiStudentProfile ? (
                /* ── Perfil alumno (desde KPI) ── */
                <div className="space-y-5">
                  <div className="rounded-2xl p-4 border" style={{ backgroundColor: "#fff1e9", borderColor: "#dcc1b9" }}>
                    {NINAS_IDS.has(kpiStudentProfile.disciplina_id) && kpiStudentProfile.nome_alumna ? (
                      <>
                        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#89726c" }}>Alumna</p>
                        <p className="text-lg font-semibold" style={{ color: "#7d2b13" }}>{kpiStudentProfile.nome_alumna} {kpiStudentProfile.cognome_alumna}</p>
                        <div className="mt-3 pt-3 border-t" style={{ borderColor: "#dcc1b9" }}>
                          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#89726c" }}>Tutor</p>
                          <p className="text-sm font-medium" style={{ color: "#25190f" }}>{kpiStudentProfile.nome} {kpiStudentProfile.cognome}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#89726c" }}>Alumna</p>
                        <p className="text-lg font-semibold" style={{ color: "#7d2b13" }}>{kpiStudentProfile.nome} {kpiStudentProfile.cognome}</p>
                      </>
                    )}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#89726c" }}>Contacto</p>
                    <div className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: "#dcc1b9" }}><Icon name="mail" className="text-base" style={{ color: "#7d2b13" }} /><p className="text-sm" style={{ color: "#25190f" }}>{kpiStudentProfile.email}</p></div>
                    {kpiStudentProfile.telefono && <div className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: "#dcc1b9" }}><Icon name="phone" className="text-base" style={{ color: "#7d2b13" }} /><p className="text-sm" style={{ color: "#25190f" }}>{kpiStudentProfile.telefono}</p></div>}
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#89726c" }}>Inscripción</p>
                    <div className="rounded-xl border divide-y" style={{ borderColor: "#dcc1b9" }}>
                      {[
                        { icon: "school", label: "Disciplina", value: kpiStudentProfile.discipline?.nome ?? kpiStudentProfile.disciplina_id },
                        { icon: "card_membership", label: "Plan", value: PLAN_LABEL[kpiStudentProfile.piano_id] ?? kpiStudentProfile.piano_id },
                        { icon: "euro", label: "Cuota mensual", value: kpiStudentProfile.prezzo != null ? `${kpiStudentProfile.prezzo} €/mes` : "—" },
                        { icon: "payments", label: "Pago", value: METODO_LABEL[kpiStudentProfile.metodo_pagamento] ?? kpiStudentProfile.metodo_pagamento },
                        { icon: "calendar_today", label: "Inscrita desde", value: formatData(kpiStudentProfile.created_at) },
                        { icon: "history", label: "Antigüedad", value: calcAntigüedad(kpiStudentProfile.created_at) },
                      ].map(({ icon, label, value }) => (
                        <div key={label} className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center gap-2"><Icon name={icon} className="text-sm" style={{ color: "#7d2b13" }} /><p className="text-xs" style={{ color: "#89726c" }}>{label}</p></div>
                          <p className="text-sm font-medium" style={{ color: "#25190f" }}>{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#dcc1b9" }}>
                    <p className="text-sm font-medium px-4 pt-4" style={{ color: "#25190f" }}>Estado de pago</p>
                    <PagoResumen stato={kpiStudentProfile.stato} matricula={kpiStudentProfile.matricula} />
                    {kpiStudentProfile.stato === "attesa" ? (
                      <button onClick={() => handleCambiarStatoKpi("pagato")} className="w-full py-3 text-sm font-semibold border-t" style={{ borderColor: "#dcc1b9", backgroundColor: "#7d2b13", color: "#fff" }}>Marcar como pagado</button>
                    ) : (
                      <button onClick={() => handleCambiarStatoKpi("attesa")} className="w-full py-3 text-sm font-semibold border-t" style={{ borderColor: "#dcc1b9", backgroundColor: "#fff1e9", color: "#89726c" }}>Deshacer pago</button>
                    )}
                  </div>
                </div>

              ) : kpiDrawer === "ocupacion" && !kpiOcupacionDisciplina ? (
                /* ── Ocupación por disciplina ── */
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#89726c" }}>Por disciplina</p>
                  {ocupacionDisciplinas.map((d) => {
                    const pct = d.total > 0 ? Math.round((d.ocupados / d.total) * 100) : 0;
                    return (
                      <button key={d.disciplina_id} onClick={() => setKpiOcupacionDisciplina(d)} className="w-full text-left p-4 rounded-xl border hover:shadow-sm transition-shadow" style={{ borderColor: "#dcc1b9", backgroundColor: "#fff1e9" }}>
                        <div className="flex justify-between items-center mb-2">
                          <p className="text-sm font-medium" style={{ color: "#25190f" }}>{d.nombre}</p>
                          <p className="text-sm font-bold" style={{ color: "#7d2b13" }}>{pct}%</p>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: pct > 75 ? "#2e7d32" : "#7d2b13" }} />
                        </div>
                        <p className="text-xs mt-1.5" style={{ color: "#89726c" }}>{d.ocupados}/{d.total} plazas · {d.clases.length} clase{d.clases.length !== 1 ? "s" : ""}</p>
                      </button>
                    );
                  })}
                </div>

              ) : kpiDrawer === "ocupacion" && kpiOcupacionDisciplina ? (
                /* ── Ocupación por clase ── */
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#89726c" }}>Clases de {kpiOcupacionDisciplina.nombre}</p>
                  {kpiOcupacionDisciplina.clases.map((c, i) => {
                    const pct = c.total > 0 ? Math.round((c.ocupados / c.total) * 100) : 0;
                    const lleno = c.ocupados >= c.total;
                    return (
                      <div key={i} className="p-4 rounded-xl border" style={{ borderColor: "#dcc1b9" }}>
                        <div className="flex justify-between items-center mb-2">
                          <div>
                            <p className="text-sm font-medium" style={{ color: "#25190f" }}>{c.giorno}</p>
                            <p className="text-xs" style={{ color: "#89726c" }}>{c.ora_inizio.substring(0, 5)} – {c.ora_fine.substring(0, 5)}</p>
                          </div>
                          <p className={`text-sm font-bold ${lleno ? "text-error" : ""}`} style={lleno ? {} : { color: "#7d2b13" }}>{c.ocupados}/{c.total}</p>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: lleno ? "#b71c1c" : "#7d2b13" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

              ) : kpiDrawer === "alumnos" && !kpiAlumnosDisciplina ? (
                /* ── Disciplinas (nivel 1) ── */
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#89726c" }}>Por disciplina</p>
                  {kpiDiscSummary.length === 0 ? (
                    <p className="text-center py-10 text-sm" style={{ color: "#89726c" }}>No hay datos</p>
                  ) : (
                    kpiDiscSummary.map((d) => {
                      const pct = d.maxCapacity > 0 ? Math.round((d.enrolled / d.maxCapacity) * 100) : 0;
                      return (
                        <button
                          key={d.disciplina_id}
                          onClick={() => handleKpiDisciplinaClick(d)}
                          className="w-full text-left p-4 rounded-xl border hover:shadow-sm transition-shadow"
                          style={{ borderColor: "#dcc1b9", backgroundColor: "#fff1e9" }}
                        >
                          <div className="flex justify-between items-center mb-2">
                            <p className="text-sm font-medium" style={{ color: "#25190f" }}>{d.nombre}</p>
                            <p className="text-sm font-bold" style={{ color: "#7d2b13" }}>{d.enrolled}/{d.maxCapacity}</p>
                          </div>
                          <div className="h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: pct > 75 ? "#2e7d32" : "#7d2b13" }} />
                          </div>
                          <p className="text-xs mt-1.5 flex items-center gap-1" style={{ color: "#89726c" }}>
                            <span>{d.enrolled} alumno{d.enrolled !== 1 ? "s" : ""}</span>
                            <span>·</span>
                            <span>Ver listado →</span>
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>

              ) : (
                /* ── Lista alumnos (pendientes / disciplina) ── */
                <div className="space-y-2">
                  {kpiStudents.length === 0 ? (
                    <p className="text-center py-10 text-sm" style={{ color: "#89726c" }}>No hay alumnos</p>
                  ) : (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#89726c" }}>{kpiStudents.length} alumno{kpiStudents.length !== 1 ? "s" : ""}</p>
                      {kpiStudents.map((s) => {
                        const esNina = NINAS_IDS.has(s.disciplina_id);
                        const displayName = esNina && s.nome_alumna ? `${s.nome_alumna} ${s.cognome_alumna}` : `${s.nome} ${s.cognome}`;
                        const subLabel = esNina && s.nome_alumna ? `Tutor: ${s.nome} ${s.cognome}` : null;
                        return (
                          <button key={s.id} onClick={() => handleKpiStudentClick(s.id)} className="w-full text-left flex items-center justify-between p-3 rounded-xl border hover:shadow-sm transition-shadow" style={{ borderColor: "#dcc1b9", backgroundColor: "#fff1e9" }}>
                            <div>
                              <p className="text-sm font-medium" style={{ color: "#25190f" }}>{displayName}</p>
                              {subLabel && <p className="text-xs mt-0.5" style={{ color: "#89726c" }}>{subLabel}</p>}
                              <p className="text-xs mt-0.5" style={{ color: "#89726c" }}>{s.discipline?.nome ?? "—"}{s.prezzo != null ? ` · ${s.prezzo}€/mes` : ""}</p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {s.stato === "attesa"
                                ? <span className="text-xs px-2 py-0.5 rounded-full bg-error-container text-on-error-container">Pendiente</span>
                                : <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#e8f5e9", color: "#2e7d32" }}>Pagado</span>}
                              <Icon name="chevron_right" className="text-base" style={{ color: "#89726c" }} />
                            </div>
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Drawer: detalle de clase / alumno ── */}
      {drawerOrario && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-[60]"
            onClick={() => setDrawerOrario(null)}
          />

          {/* Panel */}
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white z-[70] flex flex-col shadow-2xl">

            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-outline-variant" style={{ backgroundColor: "#fff8f5" }}>
              {drawerView === "student" && (
                <button
                  onClick={() => setDrawerView("class")}
                  className="p-2 rounded-full hover:bg-surface-container-high transition-colors"
                  style={{ color: "#7d2b13" }}
                  aria-label="Volver"
                >
                  <Icon name="arrow_back" />
                </button>
              )}
              <div className="flex-1 min-w-0">
                {drawerView === "class" ? (
                  <>
                    <p className="font-semibold text-sm truncate" style={{ color: "#7d2b13" }}>
                      {drawerOrario.discipline?.nome ?? drawerOrario.disciplina_id}
                    </p>
                    <p className="text-xs" style={{ color: "#89726c" }}>
                      {drawerOrario.giorno} · {drawerOrario.ora_inizio.substring(0, 5)} – {drawerOrario.ora_fine.substring(0, 5)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-sm" style={{ color: "#7d2b13" }}>
                      {drawerDetalle
                        ? (NINAS_IDS.has(drawerDetalle.disciplina_id) && drawerDetalle.nome_alumna
                          ? `${drawerDetalle.nome_alumna} ${drawerDetalle.cognome_alumna}`
                          : `${drawerDetalle.nome} ${drawerDetalle.cognome}`)
                        : "Cargando..."}
                    </p>
                    <p className="text-xs" style={{ color: "#89726c" }}>Perfil completo</p>
                  </>
                )}
              </div>
              <button
                onClick={() => setDrawerOrario(null)}
                className="p-2 rounded-full hover:bg-surface-container-high transition-colors"
                style={{ color: "#89726c" }}
                aria-label="Cerrar"
              >
                <Icon name="close" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {drawerLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div
                    className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: "#7d2b13", borderTopColor: "transparent" }}
                  />
                </div>
              ) : drawerView === "class" ? (

                /* ── Lista alumnos ── */
                <div className="space-y-2">
                  {drawerAlumnos.length === 0 ? (
                    <p className="text-center py-10 text-sm" style={{ color: "#89726c" }}>
                      No hay alumnos inscritos en esta clase
                    </p>
                  ) : (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "#89726c" }}>
                        {drawerAlumnos.length} inscrito{drawerAlumnos.length !== 1 ? "s" : ""}
                      </p>
                      {drawerAlumnos.map((a) => {
                        const isc = a.iscrizioni;
                        if (!isc) return null;
                        const esNina = NINAS_IDS.has(isc.disciplina_id);
                        const displayName = esNina && isc.nome_alumna
                          ? `${isc.nome_alumna} ${isc.cognome_alumna}`
                          : `${isc.nome} ${isc.cognome}`;
                        const subLabel = esNina && isc.nome_alumna
                          ? `Tutor: ${isc.nome} ${isc.cognome}`
                          : null;
                        return (
                          <button
                            key={a.iscrizione_id}
                            onClick={() => handleAlumnoClick(a.iscrizione_id)}
                            className="w-full text-left flex items-center justify-between p-3 rounded-xl border transition-colors hover:shadow-sm"
                            style={{ borderColor: "#dcc1b9", backgroundColor: "#fff1e9" }}
                          >
                            <div>
                              <p className="text-sm font-medium" style={{ color: "#25190f" }}>{displayName}</p>
                              {subLabel && (
                                <p className="text-xs mt-0.5" style={{ color: "#89726c" }}>{subLabel}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {isc.stato === "attesa" ? (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-error-container text-on-error-container">Pendiente</span>
                              ) : (
                                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#e8f5e9", color: "#2e7d32" }}>Pagado</span>
                              )}
                              <Icon name="chevron_right" className="text-base" style={{ color: "#89726c" } as React.CSSProperties} />
                            </div>
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>

              ) : drawerDetalle ? (

                /* ── Perfil alumno ── */
                <div className="space-y-5">

                  {/* Nombre principal */}
                  <div className="rounded-2xl p-4 border" style={{ backgroundColor: "#fff1e9", borderColor: "#dcc1b9" }}>
                    {NINAS_IDS.has(drawerDetalle.disciplina_id) && drawerDetalle.nome_alumna ? (
                      <>
                        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#89726c" }}>Alumna</p>
                        <p className="text-lg font-semibold" style={{ color: "#7d2b13" }}>
                          {drawerDetalle.nome_alumna} {drawerDetalle.cognome_alumna}
                        </p>
                        <div className="mt-3 pt-3 border-t" style={{ borderColor: "#dcc1b9" }}>
                          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#89726c" }}>Tutor</p>
                          <p className="text-sm font-medium" style={{ color: "#25190f" }}>
                            {drawerDetalle.nome} {drawerDetalle.cognome}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#89726c" }}>Alumna</p>
                        <p className="text-lg font-semibold" style={{ color: "#7d2b13" }}>
                          {drawerDetalle.nome} {drawerDetalle.cognome}
                        </p>
                      </>
                    )}
                  </div>

                  {/* Contacto */}
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#89726c" }}>Contacto</p>
                    <div className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: "#dcc1b9" }}>
                      <Icon name="mail" className="text-base" style={{ color: "#7d2b13" } as React.CSSProperties} />
                      <p className="text-sm" style={{ color: "#25190f" }}>{drawerDetalle.email}</p>
                    </div>
                    {drawerDetalle.telefono && (
                      <div className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: "#dcc1b9" }}>
                        <Icon name="phone" className="text-base" style={{ color: "#7d2b13" } as React.CSSProperties} />
                        <p className="text-sm" style={{ color: "#25190f" }}>{drawerDetalle.telefono}</p>
                      </div>
                    )}
                  </div>

                  {/* Inscripción */}
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#89726c" }}>Inscripción</p>
                    <div className="rounded-xl border divide-y" style={{ borderColor: "#dcc1b9" }}>
                      {[
                        { icon: "school", label: "Disciplina", value: drawerDetalle.discipline?.nome ?? drawerDetalle.disciplina_id },
                        { icon: "card_membership", label: "Plan", value: PLAN_LABEL[drawerDetalle.piano_id] ?? drawerDetalle.piano_id },
                        { icon: "euro", label: "Cuota mensual", value: drawerDetalle.prezzo != null ? `${drawerDetalle.prezzo} €/mes` : "—" },
                        { icon: "payments", label: "Pago", value: METODO_LABEL[drawerDetalle.metodo_pagamento] ?? drawerDetalle.metodo_pagamento },
                        { icon: "calendar_today", label: "Inscrita desde", value: formatData(drawerDetalle.created_at) },
                        { icon: "history", label: "Antigüedad", value: calcAntigüedad(drawerDetalle.created_at) },
                      ].map(({ icon, label, value }) => (
                        <div key={label} className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Icon name={icon} className="text-sm" style={{ color: "#7d2b13" } as React.CSSProperties} />
                            <p className="text-xs" style={{ color: "#89726c" }}>{label}</p>
                          </div>
                          <p className="text-sm font-medium" style={{ color: "#25190f" }}>{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Estado de pago */}
                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#dcc1b9" }}>
                    <p className="text-sm font-medium px-4 pt-4" style={{ color: "#25190f" }}>Estado de pago</p>
                    <PagoResumen stato={drawerDetalle.stato} matricula={drawerDetalle.matricula} />
                    {drawerDetalle.stato === "attesa" ? (
                      <button
                        onClick={() => handleCambiarStato("pagato")}
                        className="w-full py-3 text-sm font-semibold tracking-wide border-t transition-colors"
                        style={{ borderColor: "#dcc1b9", backgroundColor: "#7d2b13", color: "#ffffff" }}
                      >
                        Marcar como pagado
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCambiarStato("attesa")}
                        className="w-full py-3 text-sm font-semibold tracking-wide border-t transition-colors"
                        style={{ borderColor: "#dcc1b9", backgroundColor: "#fff1e9", color: "#89726c" }}
                      >
                        Deshacer pago
                      </button>
                    )}
                  </div>

                  {/* Eliminar inscripción */}
                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#dcc1b9" }}>
                    {!deleteConfirm ? (
                      <button onClick={() => setDeleteConfirm(true)} className="w-full py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors hover:bg-red-50" style={{ color: "#b71c1c" }}>
                        <Icon name="delete" className="text-base" />
                        Eliminar inscripción
                      </button>
                    ) : (
                      <div className="p-4 space-y-3">
                        <p className="text-sm font-semibold text-center" style={{ color: "#b71c1c" }}>¿Eliminar esta inscripción?</p>
                        <p className="text-xs text-center" style={{ color: "#89726c" }}>Esta acción no se puede deshacer.</p>
                        <div className="flex gap-2">
                          <button onClick={() => setDeleteConfirm(false)} className="flex-1 py-2 rounded-lg text-sm border" style={{ borderColor: "#dcc1b9", color: "#89726c" }}>Cancelar</button>
                          <button onClick={handleEliminarAlumno} disabled={deleteLoading} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: "#b71c1c" }}>
                            {deleteLoading ? "Eliminando..." : "Sí, eliminar"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Horarios */}
                  {drawerDetalle.iscrizione_orari.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#89726c" }}>Clases semanales</p>
                      <div className="space-y-1.5">
                        {drawerDetalle.iscrizione_orari
                          .filter((io) => io.orari)
                          .map((io, idx) => (
                            <div key={idx} className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: "#dcc1b9" }}>
                              <Icon name="schedule" className="text-sm" style={{ color: "#7d2b13" } as React.CSSProperties} />
                              <p className="text-sm" style={{ color: "#25190f" }}>
                                {io.orari!.giorno} · {io.orari!.ora_inizio.substring(0, 5)} – {io.orari!.ora_fine.substring(0, 5)}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                </div>
              ) : null}
            </div>
          </div>
        </>
      )}

      {/* ── Drawer: Gestión de Costes ── */}
      {showCostesDrawer && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[60]" onClick={() => { setShowCostesDrawer(false); setCostesEditId(null); setCostesDeleteId(null); }} />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white z-[70] flex flex-col shadow-2xl">

            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "#dcc1b9", backgroundColor: "#fff8f5" }}>
              <div>
                <p className="font-semibold text-sm" style={{ color: "#7d2b13" }}>Gestión de Costes</p>
                <p className="text-xs mt-0.5" style={{ color: "#89726c" }}>Total: {costesTotalMensual.toLocaleString("es-ES")}€/mes</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setShowNuevoCosto(true); }} className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold border transition-colors hover:bg-[#fff1e9]" style={{ borderColor: "#dcc1b9", color: "#7d2b13" }}>
                  <Icon name="add" className="text-sm" /> Añadir
                </button>
                <button onClick={() => { setShowCostesDrawer(false); setCostesEditId(null); setCostesDeleteId(null); }} className="p-2 rounded-full hover:bg-surface-container-high" style={{ color: "#89726c" }}>
                  <Icon name="close" />
                </button>
              </div>
            </div>

            {/* Lista */}
            <div className="flex-1 overflow-y-auto">
              {costesCategorias.map(([cat]) => {
                const items = costesData.filter(c => c.categoria === cat);
                const isAddingHere = addingToCategoria === cat;
                return (
                  <div key={cat}>
                    {/* Separatore categoria */}
                    <div className="px-5 py-2 flex items-center gap-2 sticky top-0" style={{ backgroundColor: "#fff8f5", borderBottom: "1px solid #f0e0d8" }}>
                      <Icon name={CATEGORIA_ICON[cat] ?? "label"} className="text-sm" style={{ color: "#89726c" }} />
                      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#89726c" }}>{cat}</p>
                      <p className="ml-auto text-xs font-bold" style={{ color: "#7d2b13" }}>{items.reduce((s, c) => s + c.importe_mensual, 0)}€</p>
                      <button
                        onClick={() => { setAddingToCategoria(isAddingHere ? null : cat); setInlineNuevo({ concepto: "", importe_mensual: 0, importe_anual: 0, notas: "" }); setCostesEditId(null); setCostesDeleteId(null); }}
                        className="ml-1 p-1 rounded-full hover:bg-[#f3e6e0] transition-colors"
                        style={{ color: "#7d2b13" }}
                        title={`Añadir en ${cat}`}
                      >
                        <Icon name={isAddingHere ? "remove" : "add"} className="text-sm" />
                      </button>
                    </div>

                    {items.map(c => {
                      const isEditing = costesEditId === c.id;
                      const isDeleting = costesDeleteId === c.id;

                      if (isDeleting) return (
                        <div key={c.id} className="px-5 py-4 border-b" style={{ borderColor: "#f0e0d8", backgroundColor: "#fff5f5" }}>
                          <p className="text-sm font-semibold mb-3" style={{ color: "#b71c1c" }}>¿Eliminar «{c.concepto}»?</p>
                          <div className="flex gap-2">
                            <button onClick={() => setCostesDeleteId(null)} className="flex-1 py-2 rounded-xl text-xs border" style={{ borderColor: "#dcc1b9", color: "#89726c" }}>Cancelar</button>
                            <button onClick={() => handleCosteDelete(c.id)} className="flex-1 py-2 rounded-xl text-xs font-semibold text-white" style={{ backgroundColor: "#b71c1c" }}>Sí, eliminar</button>
                          </div>
                        </div>
                      );

                      if (isEditing) return (
                        <div key={c.id} className="px-5 py-4 border-b space-y-3" style={{ borderColor: "#f0e0d8", backgroundColor: "#fff8f5" }}>
                          <input value={costesEditVals.concepto} onChange={e => setCostesEditVals(p => ({ ...p, concepto: e.target.value }))} placeholder="Concepto" className="w-full border rounded-xl px-3 py-2 text-sm" style={{ borderColor: "#dcc1b9" }} />
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-xs" style={{ color: "#89726c" }}>Mensual (€)</label>
                              <input type="number" min={0} value={costesEditVals.importe_mensual} onChange={e => setCostesEditVals(p => ({ ...p, importe_mensual: Number(e.target.value) }))} className="w-full border rounded-xl px-3 py-2 text-sm mt-1" style={{ borderColor: "#dcc1b9" }} />
                            </div>
                            <div>
                              <label className="text-xs" style={{ color: "#89726c" }}>Anual (€)</label>
                              <input type="number" min={0} value={costesEditVals.importe_anual} onChange={e => setCostesEditVals(p => ({ ...p, importe_anual: Number(e.target.value) }))} className="w-full border rounded-xl px-3 py-2 text-sm mt-1" style={{ borderColor: "#dcc1b9" }} />
                            </div>
                          </div>
                          <input value={costesEditVals.notas} onChange={e => setCostesEditVals(p => ({ ...p, notas: e.target.value }))} placeholder="Notas (opcional)" className="w-full border rounded-xl px-3 py-2 text-sm" style={{ borderColor: "#dcc1b9" }} />
                          <div className="flex gap-2">
                            <button onClick={() => setCostesEditId(null)} className="flex-1 py-2 rounded-xl text-xs border" style={{ borderColor: "#dcc1b9", color: "#89726c" }}>Cancelar</button>
                            <button onClick={() => handleCosteSave(c.id)} className="flex-1 py-2 rounded-xl text-xs font-semibold text-white" style={{ backgroundColor: "#7d2b13" }}>Guardar</button>
                          </div>
                        </div>
                      );

                      return (
                        <div key={c.id} className="flex items-center justify-between px-5 py-4 border-b group hover:bg-[#fff8f5] transition-colors" style={{ borderColor: "#f0e0d8" }}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium" style={{ color: "#25190f" }}>{c.concepto}</p>
                            {c.notas && <p className="text-xs mt-0.5 truncate" style={{ color: "#89726c" }}>{c.notas}</p>}
                          </div>
                          <div className="flex items-center gap-3 ml-3 shrink-0">
                            <p className="text-sm font-bold" style={{ color: "#7d2b13" }}>{c.importe_mensual}€</p>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleCosteEdit(c)} className="p-1.5 rounded-lg hover:bg-surface-container-high" style={{ color: "#7d2b13" }}><Icon name="edit" className="text-sm" /></button>
                              <button onClick={() => { setCostesDeleteId(c.id); setCostesEditId(null); }} className="p-1.5 rounded-lg hover:bg-red-50" style={{ color: "#b71c1c" }}><Icon name="delete" className="text-sm" /></button>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* Form inline aggiunta per questa categoria */}
                    {isAddingHere && (
                      <div className="px-5 py-4 border-b space-y-3" style={{ borderColor: "#f0e0d8", backgroundColor: "#f9f4f1" }}>
                        <input
                          autoFocus
                          placeholder="Concepto *"
                          value={inlineNuevo.concepto}
                          onChange={e => setInlineNuevo(p => ({ ...p, concepto: e.target.value }))}
                          className="w-full border rounded-xl px-3 py-2 text-sm"
                          style={{ borderColor: "#dcc1b9" }}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs mb-1 block" style={{ color: "#89726c" }}>Mensual (€)</label>
                            <input
                              type="number" min={0}
                              value={inlineNuevo.importe_mensual}
                              onChange={e => setInlineNuevo(p => ({ ...p, importe_mensual: Number(e.target.value), importe_anual: Number(e.target.value) * 12 }))}
                              className="w-full border rounded-xl px-3 py-2 text-sm"
                              style={{ borderColor: "#dcc1b9" }}
                            />
                          </div>
                          <div>
                            <label className="text-xs mb-1 block" style={{ color: "#89726c" }}>Anual (€)</label>
                            <input
                              type="number" min={0}
                              value={inlineNuevo.importe_anual}
                              onChange={e => setInlineNuevo(p => ({ ...p, importe_anual: Number(e.target.value) }))}
                              className="w-full border rounded-xl px-3 py-2 text-sm"
                              style={{ borderColor: "#dcc1b9" }}
                            />
                          </div>
                        </div>
                        <input
                          placeholder="Notas (opcional)"
                          value={inlineNuevo.notas}
                          onChange={e => setInlineNuevo(p => ({ ...p, notas: e.target.value }))}
                          className="w-full border rounded-xl px-3 py-2 text-sm"
                          style={{ borderColor: "#dcc1b9" }}
                        />
                        <div className="flex gap-2">
                          <button onClick={() => setAddingToCategoria(null)} className="flex-1 py-2 rounded-xl text-xs border" style={{ borderColor: "#dcc1b9", color: "#89726c" }}>Cancelar</button>
                          <button onClick={() => handleInlineNuevoSave(cat)} disabled={!inlineNuevo.concepto.trim()} className="flex-1 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-40" style={{ backgroundColor: "#7d2b13" }}>Guardar</button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer totale */}
            <div className="p-5 border-t flex justify-between items-center" style={{ borderColor: "#dcc1b9", backgroundColor: "#fff8f5" }}>
              <p className="text-sm font-semibold" style={{ color: "#89726c" }}>Total mensual</p>
              <p className="text-xl font-bold" style={{ color: "#7d2b13" }}>{costesTotalMensual.toLocaleString("es-ES")}€</p>
            </div>
          </div>
        </>
      )}

      {/* ── Modal: Nuevo Costo ── */}
      {showNuevoCosto && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[80]" onClick={() => setShowNuevoCosto(false)} />
          <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white z-[90] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "#dcc1b9", backgroundColor: "#fff8f5" }}>
              <p className="font-semibold text-sm" style={{ color: "#7d2b13" }}>Nueva Partida de Coste</p>
              <button onClick={() => setShowNuevoCosto(false)} className="p-2 rounded-full hover:bg-surface-container-high" style={{ color: "#89726c" }}><Icon name="close" /></button>
            </div>
            <div className="flex-1 p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="text-xs uppercase tracking-widest font-semibold block mb-1.5" style={{ color: "#89726c" }}>Categoría</label>
                <select value={nuevoCosto.categoria} onChange={e => setNuevoCosto(p => ({ ...p, categoria: e.target.value }))} className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white" style={{ borderColor: "#dcc1b9", color: "#25190f" }}>
                  {Object.keys(CATEGORIA_ICON).map(c => <option key={c} value={c}>{c}</option>)}
                  <option value="Otros">Otros</option>
                </select>
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest font-semibold block mb-1.5" style={{ color: "#89726c" }}>Concepto *</label>
                <input value={nuevoCosto.concepto} onChange={e => setNuevoCosto(p => ({ ...p, concepto: e.target.value }))} placeholder="Ej: Limpieza local" className="w-full border rounded-xl px-3 py-2.5 text-sm" style={{ borderColor: "#dcc1b9" }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase tracking-widest font-semibold block mb-1.5" style={{ color: "#89726c" }}>Mensual (€)</label>
                  <input type="number" min={0} value={nuevoCosto.importe_mensual} onChange={e => setNuevoCosto(p => ({ ...p, importe_mensual: Number(e.target.value), importe_anual: Number(e.target.value) * 12 }))} className="w-full border rounded-xl px-3 py-2.5 text-sm" style={{ borderColor: "#dcc1b9" }} />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest font-semibold block mb-1.5" style={{ color: "#89726c" }}>Anual (€)</label>
                  <div className="w-full border rounded-xl px-3 py-2.5 text-sm bg-surface-container-high font-semibold" style={{ borderColor: "#dcc1b9", color: "#89726c" }}>{(nuevoCosto.importe_mensual * 12).toLocaleString("es-ES")}€</div>
                </div>
              </div>
              <div>
                <label className="text-xs uppercase tracking-widest font-semibold block mb-1.5" style={{ color: "#89726c" }}>Notas</label>
                <input value={nuevoCosto.notas} onChange={e => setNuevoCosto(p => ({ ...p, notas: e.target.value }))} placeholder="Opcional" className="w-full border rounded-xl px-3 py-2.5 text-sm" style={{ borderColor: "#dcc1b9" }} />
              </div>
            </div>
            <div className="p-5 border-t" style={{ borderColor: "#dcc1b9" }}>
              <button onClick={handleNuevoCostoSubmit} disabled={!nuevoCosto.concepto} className="w-full py-3 rounded-full text-sm font-semibold text-white disabled:opacity-40" style={{ backgroundColor: "#7d2b13" }}>
                Guardar partida
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Modal: Nueva Inscripción ── */}
      {showNuevaInscripcion && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[80]" onClick={() => setShowNuevaInscripcion(false)} />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white z-[90] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "#dcc1b9", backgroundColor: "#fff8f5" }}>
              <p className="font-semibold text-sm" style={{ color: "#7d2b13" }}>Nueva Inscripción</p>
              <button onClick={() => setShowNuevaInscripcion(false)} className="p-2 rounded-full hover:bg-surface-container-high" style={{ color: "#89726c" }}><Icon name="close" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">

              {/* Disciplina */}
              <div>
                <label className="text-xs uppercase tracking-widest font-semibold block mb-1.5" style={{ color: "#89726c" }}>Disciplina *</label>
                <select value={nif.disciplina_id} onChange={e => handleNifDisciplinaChange(e.target.value)} className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white" style={{ borderColor: "#dcc1b9", color: "#25190f" }}>
                  <option value="">Selecciona disciplina</option>
                  {disciplinasDisponibles.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                </select>
              </div>

              {/* Plan */}
              {nifPiani.length > 0 && (
                <div>
                  <label className="text-xs uppercase tracking-widest font-semibold block mb-1.5" style={{ color: "#89726c" }}>Plan *</label>
                  <select value={nif.piano_id} onChange={e => setNif(p => ({ ...p, piano_id: e.target.value }))} className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white" style={{ borderColor: "#dcc1b9", color: "#25190f" }}>
                    <option value="">Selecciona plan</option>
                    {nifPiani.map(p => <option key={p.id} value={p.id}>{PLAN_LABEL[p.id] ?? p.nome} — {p.prezzo}€/mes</option>)}
                  </select>
                </div>
              )}

              {/* Horarios */}
              {orariosForNif.length > 0 && (
                <div>
                  <label className="text-xs uppercase tracking-widest font-semibold block mb-1.5" style={{ color: "#89726c" }}>Horarios</label>
                  <div className="space-y-2">
                    {orariosForNif.map(o => {
                      const checked = nif.horarios.includes(o.id);
                      return (
                        <label key={o.id} className="flex items-center gap-3 p-3 rounded-xl border cursor-pointer hover:bg-[#fff8f5]" style={{ borderColor: checked ? "#7d2b13" : "#dcc1b9" }}>
                          <input type="checkbox" checked={checked} onChange={() => setNif(p => ({ ...p, horarios: checked ? p.horarios.filter(id => id !== o.id) : [...p.horarios, o.id] }))} className="accent-[#7d2b13]" />
                          <span className="text-sm" style={{ color: "#25190f" }}>{o.giorno} · {o.ora_inizio.substring(0, 5)} – {o.ora_fine.substring(0, 5)}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Datos tutora / alumna */}
              {esNinaNif && (
                <div className="p-4 rounded-xl border space-y-3" style={{ borderColor: "#dcc1b9", backgroundColor: "#fff8f5" }}>
                  <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#89726c" }}>Alumna (niña)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <input placeholder="Nombre alumna *" value={nif.nome_alumna} onChange={e => setNif(p => ({ ...p, nome_alumna: e.target.value }))} className="border rounded-xl px-3 py-2.5 text-sm" style={{ borderColor: "#dcc1b9" }} />
                    <input placeholder="Apellido alumna *" value={nif.cognome_alumna} onChange={e => setNif(p => ({ ...p, cognome_alumna: e.target.value }))} className="border rounded-xl px-3 py-2.5 text-sm" style={{ borderColor: "#dcc1b9" }} />
                  </div>
                </div>
              )}

              {/* Datos tutora / adulta */}
              <div className="space-y-3">
                <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#89726c" }}>{esNinaNif ? "Tutora" : "Alumna"}</p>
                <div className="grid grid-cols-2 gap-3">
                  <input placeholder="Nombre *" value={nif.nome} onChange={e => setNif(p => ({ ...p, nome: e.target.value }))} className="border rounded-xl px-3 py-2.5 text-sm" style={{ borderColor: "#dcc1b9" }} />
                  <input placeholder="Apellido *" value={nif.cognome} onChange={e => setNif(p => ({ ...p, cognome: e.target.value }))} className="border rounded-xl px-3 py-2.5 text-sm" style={{ borderColor: "#dcc1b9" }} />
                </div>
                <input placeholder="Email *" type="email" value={nif.email} onChange={e => setNif(p => ({ ...p, email: e.target.value }))} className="w-full border rounded-xl px-3 py-2.5 text-sm" style={{ borderColor: "#dcc1b9" }} />
                <input placeholder="Teléfono" value={nif.telefono} onChange={e => setNif(p => ({ ...p, telefono: e.target.value }))} className="w-full border rounded-xl px-3 py-2.5 text-sm" style={{ borderColor: "#dcc1b9" }} />
              </div>

              {/* Método de pago */}
              <div>
                <label className="text-xs uppercase tracking-widest font-semibold block mb-1.5" style={{ color: "#89726c" }}>Método de pago</label>
                <select value={nif.metodo_pagamento} onChange={e => setNif(p => ({ ...p, metodo_pagamento: e.target.value }))} className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white" style={{ borderColor: "#dcc1b9", color: "#25190f" }}>
                  {Object.entries(METODO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>

            </div>
            <div className="p-5 border-t" style={{ borderColor: "#dcc1b9" }}>
              <button onClick={handleNuevaInscripcionSubmit} disabled={nifLoading || !nif.nome || !nif.email || !nif.disciplina_id || !nif.piano_id} className="w-full py-3 rounded-full text-sm font-semibold text-white transition-opacity disabled:opacity-40" style={{ backgroundColor: "#7d2b13" }}>
                {nifLoading ? "Guardando..." : "Crear inscripción"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Modal: Nuevo Horario ── */}
      {showNuevoHorario && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[80]" onClick={() => setShowNuevoHorario(false)} />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white z-[90] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: "#dcc1b9", backgroundColor: "#fff8f5" }}>
              <p className="font-semibold text-sm" style={{ color: "#7d2b13" }}>Nueva Clase</p>
              <button onClick={() => setShowNuevoHorario(false)} className="p-2 rounded-full hover:bg-surface-container-high" style={{ color: "#89726c" }}><Icon name="close" /></button>
            </div>
            <div className="flex-1 p-5 space-y-4">

              <div>
                <label className="text-xs uppercase tracking-widest font-semibold block mb-1.5" style={{ color: "#89726c" }}>Disciplina *</label>
                <select value={nhf.disciplina_id} onChange={e => setNhf(p => ({ ...p, disciplina_id: e.target.value }))} className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white" style={{ borderColor: "#dcc1b9", color: "#25190f" }}>
                  <option value="">Selecciona disciplina</option>
                  {disciplinasDisponibles.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest font-semibold block mb-1.5" style={{ color: "#89726c" }}>Día *</label>
                <select value={nhf.giorno} onChange={e => setNhf(p => ({ ...p, giorno: e.target.value }))} className="w-full border rounded-xl px-3 py-2.5 text-sm bg-white" style={{ borderColor: "#dcc1b9", color: "#25190f" }}>
                  {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase tracking-widest font-semibold block mb-1.5" style={{ color: "#89726c" }}>Hora inicio *</label>
                  <input type="time" value={nhf.ora_inizio} onChange={e => setNhf(p => ({ ...p, ora_inizio: e.target.value }))} className="w-full border rounded-xl px-3 py-2.5 text-sm" style={{ borderColor: "#dcc1b9" }} />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest font-semibold block mb-1.5" style={{ color: "#89726c" }}>Hora fin *</label>
                  <input type="time" value={nhf.ora_fine} onChange={e => setNhf(p => ({ ...p, ora_fine: e.target.value }))} className="w-full border rounded-xl px-3 py-2.5 text-sm" style={{ borderColor: "#dcc1b9" }} />
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-widest font-semibold block mb-1.5" style={{ color: "#89726c" }}>Plazas máx.</label>
                <input type="number" min={1} max={30} value={nhf.posti_totali} onChange={e => setNhf(p => ({ ...p, posti_totali: Number(e.target.value) }))} className="w-full border rounded-xl px-3 py-2.5 text-sm" style={{ borderColor: "#dcc1b9" }} />
              </div>

            </div>
            <div className="p-5 border-t" style={{ borderColor: "#dcc1b9" }}>
              <button onClick={handleNuevoHorarioSubmit} disabled={nhfLoading || !nhf.disciplina_id} className="w-full py-3 rounded-full text-sm font-semibold text-white transition-opacity disabled:opacity-40" style={{ backgroundColor: "#7d2b13" }}>
                {nhfLoading ? "Guardando..." : "Crear clase"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Drawer: perfil usuario ── */}
      {(usuariosProfile || usuariosProfileLoading) && (
        <>
          <div className="fixed inset-0 bg-black/40 z-[60]" onClick={() => { setUsuariosProfile(null); setUsuariosProfileLoading(false); }} />
          <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white z-[70] flex flex-col shadow-2xl">

            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-outline-variant" style={{ backgroundColor: "#fff8f5" }}>
              <div className="flex-1 min-w-0">
                {usuariosProfileLoading ? (
                  <p className="text-sm font-semibold" style={{ color: "#7d2b13" }}>Cargando...</p>
                ) : usuariosProfile ? (
                  <>
                    <p className="font-semibold text-sm truncate" style={{ color: "#7d2b13" }}>
                      {NINAS_IDS.has(usuariosProfile.disciplina_id) && usuariosProfile.nome_alumna
                        ? `${usuariosProfile.nome_alumna} ${usuariosProfile.cognome_alumna}`
                        : `${usuariosProfile.nome} ${usuariosProfile.cognome}`}
                    </p>
                    <p className="text-xs" style={{ color: "#89726c" }}>Perfil completo</p>
                  </>
                ) : null}
              </div>
              <button onClick={() => { setUsuariosProfile(null); setUsuariosProfileLoading(false); }} className="p-2 rounded-full hover:bg-surface-container-high" style={{ color: "#89726c" }}>
                <Icon name="close" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {usuariosProfileLoading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#7d2b13", borderTopColor: "transparent" }} />
                </div>
              ) : usuariosProfile ? (
                <div className="space-y-5">

                  {/* Nombre */}
                  <div className="rounded-2xl p-4 border" style={{ backgroundColor: "#fff1e9", borderColor: "#dcc1b9" }}>
                    {NINAS_IDS.has(usuariosProfile.disciplina_id) && usuariosProfile.nome_alumna ? (
                      <>
                        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#89726c" }}>Alumna</p>
                        <p className="text-lg font-semibold" style={{ color: "#7d2b13" }}>{usuariosProfile.nome_alumna} {usuariosProfile.cognome_alumna}</p>
                        <div className="mt-3 pt-3 border-t" style={{ borderColor: "#dcc1b9" }}>
                          <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#89726c" }}>Tutor</p>
                          <p className="text-sm font-medium" style={{ color: "#25190f" }}>{usuariosProfile.nome} {usuariosProfile.cognome}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-xs uppercase tracking-widest mb-1" style={{ color: "#89726c" }}>Alumna</p>
                        <p className="text-lg font-semibold" style={{ color: "#7d2b13" }}>{usuariosProfile.nome} {usuariosProfile.cognome}</p>
                      </>
                    )}
                  </div>

                  {/* Contacto */}
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#89726c" }}>Contacto</p>
                    <div className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: "#dcc1b9" }}>
                      <Icon name="mail" className="text-base" style={{ color: "#7d2b13" }} />
                      <p className="text-sm break-all flex-1" style={{ color: "#25190f" }}>{usuariosProfile.email}</p>
                      <button
                        onClick={() => { navigator.clipboard?.writeText(usuariosProfile.email); setCopiedEmail(true); setTimeout(() => setCopiedEmail(false), 1500); }}
                        className="p-1.5 rounded-lg hover:bg-[#fff1e9] transition-colors shrink-0"
                        title="Copiar email" aria-label="Copiar email"
                      >
                        <Icon name={copiedEmail ? "check" : "content_copy"} className="text-base" style={{ color: copiedEmail ? "#2e7d32" : "#7d2b13" }} />
                      </button>
                      <a href={`mailto:${usuariosProfile.email}`} className="p-1.5 rounded-lg hover:bg-[#fff1e9] transition-colors shrink-0" title="Enviar email" aria-label="Enviar email">
                        <Icon name="send" className="text-base" style={{ color: "#7d2b13" }} />
                      </a>
                    </div>
                    {usuariosProfile.telefono && (
                      <div className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: "#dcc1b9" }}>
                        <Icon name="phone" className="text-base" style={{ color: "#7d2b13" }} />
                        <p className="text-sm flex-1" style={{ color: "#25190f" }}>{usuariosProfile.telefono}</p>
                        <a
                          href={whatsappHref(usuariosProfile.telefono)} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0"
                          style={{ backgroundColor: "#25d366", color: "#fff" }}
                          title="Escribir por WhatsApp"
                        >
                          <Icon name="chat" className="text-sm" /> WhatsApp
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Inscripción */}
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#89726c" }}>Inscripción</p>
                    <div className="rounded-xl border divide-y" style={{ borderColor: "#dcc1b9" }}>
                      {[
                        { icon: "school", label: "Disciplina", value: usuariosProfile.discipline?.nome ?? usuariosProfile.disciplina_id },
                        { icon: "card_membership", label: "Plan", value: PLAN_LABEL[usuariosProfile.piano_id] ?? usuariosProfile.piano_id },
                        { icon: "euro", label: "Cuota mensual", value: usuariosProfile.prezzo != null ? `${usuariosProfile.prezzo} €/mes` : "—" },
                        { icon: "payments", label: "Método de pago", value: METODO_LABEL[usuariosProfile.metodo_pagamento] ?? usuariosProfile.metodo_pagamento },
                        { icon: "calendar_today", label: "Inscrita desde", value: formatData(usuariosProfile.created_at) },
                        { icon: "history", label: "Antigüedad", value: calcAntigüedad(usuariosProfile.created_at) },
                      ].map(({ icon, label, value }) => (
                        <div key={label} className="flex items-center justify-between px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Icon name={icon} className="text-sm" style={{ color: "#7d2b13" }} />
                            <p className="text-xs" style={{ color: "#89726c" }}>{label}</p>
                          </div>
                          <p className="text-sm font-medium" style={{ color: "#25190f" }}>{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Horarios */}
                  {usuariosProfile.iscrizione_orari && usuariosProfile.iscrizione_orari.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#89726c" }}>Horarios</p>
                      <div className="rounded-xl border divide-y" style={{ borderColor: "#dcc1b9" }}>
                        {usuariosProfile.iscrizione_orari.map((io, i) => io.orari && (
                          <div key={i} className="flex items-center gap-3 px-4 py-3">
                            <Icon name="schedule" className="text-sm" style={{ color: "#7d2b13" }} />
                            <p className="text-sm" style={{ color: "#25190f" }}>
                              {io.orari.giorno} · {io.orari.ora_inizio.substring(0, 5)} – {io.orari.ora_fine.substring(0, 5)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Asistencia */}
                  {asistenciaResumen && asistenciaResumen.total > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#89726c" }}>Asistencia</p>
                      <div className="rounded-xl border p-4 flex items-center gap-4" style={{ borderColor: "#dcc1b9" }}>
                        <div className="text-center shrink-0">
                          <p className="text-2xl font-bold" style={{ color: asistenciaResumen.porcentaje != null && asistenciaResumen.porcentaje >= 80 ? "#2e7d32" : asistenciaResumen.porcentaje != null && asistenciaResumen.porcentaje >= 50 ? "#e65100" : "#b71c1c" }}>
                            {asistenciaResumen.porcentaje}%
                          </p>
                          <p className="text-[10px] uppercase tracking-wide" style={{ color: "#89726c" }}>asistencia</p>
                        </div>
                        <div className="flex-1 text-xs space-y-0.5" style={{ color: "#56423d" }}>
                          <p><span style={{ color: "#2e7d32", fontWeight: 600 }}>{asistenciaResumen.presente}</span> presente{asistenciaResumen.presente !== 1 ? "s" : ""}</p>
                          <p><span style={{ color: "#b71c1c", fontWeight: 600 }}>{asistenciaResumen.falta}</span> falta{asistenciaResumen.falta !== 1 ? "s" : ""}</p>
                          <p><span style={{ color: "#e65100", fontWeight: 600 }}>{asistenciaResumen.justificada}</span> justificada{asistenciaResumen.justificada !== 1 ? "s" : ""}</p>
                          <p style={{ color: "#89726c" }}>{asistenciaResumen.total} clase{asistenciaResumen.total !== 1 ? "s" : ""} registrada{asistenciaResumen.total !== 1 ? "s" : ""}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Estado */}
                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#dcc1b9" }}>
                    <div className="flex items-center justify-between p-4">
                      <p className="text-sm font-medium" style={{ color: "#25190f" }}>Estado</p>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: statoInfo(usuariosProfile.stato).bg, color: statoInfo(usuariosProfile.stato).color }}>
                        {statoInfo(usuariosProfile.stato).label}
                      </span>
                    </div>
                    <div className="border-t" style={{ borderColor: "#dcc1b9" }}>
                      <PagoResumen stato={usuariosProfile.stato} matricula={usuariosProfile.matricula} />
                    </div>
                    {usuariosProfile.stripe_subscription_id && SUB_CANCELABLE.has(usuariosProfile.stato) ? (
                      confirmCancelSub ? (
                        <div className="flex border-t" style={{ borderColor: "#dcc1b9" }}>
                          <button onClick={handleCancelarSuscripcion} disabled={cancelandoSub} className="flex-1 py-3 text-sm font-semibold" style={{ backgroundColor: "#b71c1c", color: "#fff" }}>
                            {cancelandoSub ? "Cancelando..." : "Sí, dar de baja"}
                          </button>
                          <button onClick={() => setConfirmCancelSub(false)} className="flex-1 py-3 text-sm" style={{ backgroundColor: "#fff1e9", color: "#89726c" }}>
                            No
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmCancelSub(true)} className="w-full py-3 text-sm font-semibold border-t" style={{ borderColor: "#dcc1b9", backgroundColor: "#fff1e9", color: "#b71c1c" }}>
                          Cancelar suscripción del bono
                        </button>
                      )
                    ) : usuariosProfile.stato === "attesa" ? (
                      <button onClick={() => handleCambiarStatoUsuario("pagato")} className="w-full py-3 text-sm font-semibold border-t" style={{ borderColor: "#dcc1b9", backgroundColor: "#7d2b13", color: "#fff" }}>
                        Marcar como pagado
                      </button>
                    ) : (usuariosProfile.stato === "pagato" || usuariosProfile.stato === "pagado") ? (
                      <button onClick={() => handleCambiarStatoUsuario("attesa")} className="w-full py-3 text-sm font-semibold border-t" style={{ borderColor: "#dcc1b9", backgroundColor: "#fff1e9", color: "#89726c" }}>
                        Deshacer pago
                      </button>
                    ) : null}
                  </div>

                  {/* Eliminar */}
                  <button
                    onClick={handleEliminarUsuario}
                    className="w-full py-3 rounded-xl text-sm font-semibold border transition-colors hover:bg-red-50"
                    style={{ borderColor: "#ffcdd2", color: "#b71c1c" }}
                  >
                    Eliminar alumna
                  </button>

                </div>
              ) : null}
            </div>

          </div>
        </>
      )}

    </div>
  );
}
