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
  const [matriculasMes, setMatriculasMes] = useState(0);

  // Sofia chat
  type SofiaMessage = { role: "user" | "assistant"; content: string };
  const [sofiaMessages, setSofiaMessages] = useState<SofiaMessage[]>([]);
  const [sofiaInput, setSofiaInput] = useState("");
  const [sofiaLoading, setSofiaLoading] = useState(false);

  // ── Usuarios state ──
  const [usuariosData, setUsuariosData] = useState<KpiStudentRow[]>([]);
  const [usuariosLoading, setUsuariosLoading] = useState(false);
  const [usuariosSearch, setUsuariosSearch] = useState("");
  const [usuariosProfile, setUsuariosProfile] = useState<IscrizioneDetalle | null>(null);
  const [usuariosProfileLoading, setUsuariosProfileLoading] = useState(false);

  // KPI drawer
  const [kpiDrawer, setKpiDrawer] = useState<"pendientes" | "alumnos" | "ocupacion" | null>(null);
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
    const [r1, r3, r5] = await Promise.all([
      supabase.from("iscrizioni").select("*", { count: "exact", head: true }).eq("stato", "pagato"),
      supabase.from("iscrizioni").select("*", { count: "exact", head: true }).eq("stato", "attesa"),
      supabase
        .from("iscrizioni")
        .select("id, nome, cognome, nome_alumna, cognome_alumna, stato, created_at, discipline(nome), iscrizione_orari(orari(giorno, ora_inizio))")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
    setIscrittiCount(r1.count ?? 0);
    setPendingCount(r3.count ?? 0);
    setBookings((r5.data as unknown as IscrzioneRow[]) ?? []);
    return todayEs;
  };

  const handleOrarioClick = async (orario: AdminOrario) => {
    setDrawerOrario(orario);
    setDrawerView("class");
    setDrawerDetalle(null);
    setDrawerLoading(true);
    const { data } = await supabase
      .from("iscrizione_orari")
      .select("iscrizione_id, iscrizioni(id, nome, cognome, nome_alumna, cognome_alumna, disciplina_id, stato)")
      .eq("orario_id", orario.id);
    setDrawerAlumnos((data as unknown as OrarioAlumno[]) ?? []);
    setDrawerLoading(false);
  };

  const handleCambiarStato = async (nuevoStato: string) => {
    if (!drawerDetalle) return;
    const { error } = await supabase
      .from("iscrizioni")
      .update({ stato: nuevoStato })
      .eq("id", drawerDetalle.id);
    if (!error) {
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
    const { data } = await supabase
      .from("iscrizioni")
      .select("id, nome, cognome, nome_alumna, cognome_alumna, email, telefono, stato, created_at, disciplina_id, piano_id, metodo_pagamento, discipline(nome), iscrizione_orari(orari(giorno, ora_inizio, ora_fine))")
      .eq("id", iscrizioneId)
      .single();
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
      supabase.from("iscrizioni").select("created_at, disciplina_id, piano_id, matricula").eq("stato", "pagato"),
      supabase.from("piani").select("id, disciplina_id, prezzo"),
      supabase.from("costes").select("importe_mensual").eq("activo", true),
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
        const mrr = ((isc ?? []) as { created_at: string; disciplina_id: string; piano_id: string; matricula: number }[])
          .filter(v => v.created_at.substring(0, 7) <= mes)
          .reduce((s, v) => s + (pm[`${v.piano_id}:${v.disciplina_id}`] ?? 0), 0);
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
    supabase.from("costes").select("id, categoria, concepto, importe_mensual, importe_anual, notas").eq("activo", true).order("categoria").then(({ data }) => {
      setCostesData((data ?? []) as typeof costesData);
      setCostesLoading(false);
    });
  }, [activeSection]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeSection !== "Ventas") return;
    fetchVentas();
  }, [activeSection]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeSection !== "Usuarios") return;
    setUsuariosLoading(true);
    Promise.all([
      supabase.from("iscrizioni").select("id, nome, cognome, nome_alumna, cognome_alumna, disciplina_id, piano_id, stato, created_at, discipline(nome)").order("created_at", { ascending: false }),
      supabase.from("piani").select("id, disciplina_id, prezzo"),
    ]).then(([{ data: isc }, { data: piani }]) => {
      const pm: Record<string, number> = {};
      for (const p of (piani ?? []) as { id: string; disciplina_id: string; prezzo: number }[])
        pm[`${p.id}:${p.disciplina_id}`] = p.prezzo;
      setUsuariosData(((isc ?? []) as unknown as KpiStudentRow[]).map(i => ({ ...i, prezzo: pm[`${i.piano_id}:${i.disciplina_id}`] ?? null })));
      setUsuariosLoading(false);
    });
  }, [activeSection]); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchVentas() {
    setVentasLoading(true);
    const [{ data: isc }, { data: piani }] = await Promise.all([
      supabase
        .from("iscrizioni")
        .select("id, created_at, stato, disciplina_id, piano_id, nome, cognome, nome_alumna, cognome_alumna, discipline(nome)")
        .order("created_at", { ascending: false }),
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
    await supabase.from("costes").update({ concepto: costesEditVals.concepto, importe_mensual: costesEditVals.importe_mensual, importe_anual: costesEditVals.importe_anual, notas: costesEditVals.notas || null }).eq("id", id);
    setCostesData(prev => prev.map(c => c.id === id ? { ...c, ...costesEditVals, notas: costesEditVals.notas || null } : c));
    setCostesEditId(null);
  };

  const handleCosteDelete = async (id: string) => {
    await supabase.from("costes").update({ activo: false }).eq("id", id);
    setCostesData(prev => prev.filter(c => c.id !== id));
    setCostesDeleteId(null);
  };

  const handleInlineNuevoSave = async (categoria: string) => {
    if (!inlineNuevo.concepto.trim()) return;
    const { data } = await supabase
      .from("costes")
      .insert({ categoria, concepto: inlineNuevo.concepto, importe_mensual: inlineNuevo.importe_mensual, importe_anual: inlineNuevo.importe_anual, notas: inlineNuevo.notas || null, activo: true })
      .select("id, categoria, concepto, importe_mensual, importe_anual, notas")
      .single();
    if (data) setCostesData(prev => [...prev, data as CosteRow]);
    setAddingToCategoria(null);
    setInlineNuevo({ concepto: "", importe_mensual: 0, importe_anual: 0, notas: "" });
  };

  const handleNuevoCostoSubmit = async () => {
    if (!nuevoCosto.concepto) return;
    const { data } = await supabase.from("costes").insert({ categoria: nuevoCosto.categoria, concepto: nuevoCosto.concepto, importe_mensual: nuevoCosto.importe_mensual, importe_anual: nuevoCosto.importe_anual, notas: nuevoCosto.notas || null, activo: true }).select("id, categoria, concepto, importe_mensual, importe_anual, notas").single();
    if (data) setCostesData(prev => [...prev, data as { id: string; categoria: string; concepto: string; importe_mensual: number; importe_anual: number; notas: string | null }]);
    setShowNuevoCosto(false);
    setNuevoCosto({ categoria: "Otros", concepto: "", importe_mensual: 0, importe_anual: 0, notas: "" });
  };

  // ── Eliminar alumno ──
  const handleEliminarAlumno = async () => {
    if (!drawerDetalle) return;
    setDeleteLoading(true);
    await supabase.from("iscrizione_orari").delete().eq("iscrizione_id", drawerDetalle.id);
    await supabase.from("iscrizioni").delete().eq("id", drawerDetalle.id);
    if (drawerDetalle.stato === "attesa") {
      setPendingCount(p => Math.max(0, p - 1));
      setPendingAmount(p => Math.max(0, p - (drawerDetalle.prezzo ?? 0)));
    } else if (drawerDetalle.stato === "pagato") {
      setIscrittiCount(p => Math.max(0, p - 1));
      setFacturacionMes(p => Math.max(0, p - (drawerDetalle.prezzo ?? 0)));
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
    const emailNorm = nif.email.toLowerCase().trim();
    let contattoId: string;
    const { data: existing } = await supabase.from("contatti").select("id").eq("email", emailNorm).maybeSingle();
    if (existing) {
      contattoId = existing.id;
    } else {
      const { data: newC } = await supabase.from("contatti").insert({ nome: nif.nome, cognome: nif.cognome, email: emailNorm, telefono: nif.telefono || null }).select("id").single();
      contattoId = newC!.id;
    }
    const { data: isc } = await supabase.from("iscrizioni").insert({
      contatto_id: contattoId, nome: nif.nome, cognome: nif.cognome, email: emailNorm,
      telefono: nif.telefono || null, disciplina_id: nif.disciplina_id, piano_id: nif.piano_id,
      metodo_pagamento: nif.metodo_pagamento, stato: "attesa",
      nome_alumna: nif.nome_alumna || null, cognome_alumna: nif.cognome_alumna || null,
    }).select("id").single();
    if (isc && nif.horarios.length > 0) {
      await supabase.from("iscrizione_orari").insert(nif.horarios.map(orario_id => ({ iscrizione_id: isc.id, orario_id })));
    }
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

  const ajustarMetrics = (iscrizione: { prezzo?: number | null }, fromStato: string, toStato: string) => {
    const prezzo = iscrizione.prezzo ?? 0;
    if (fromStato === "attesa" && toStato === "pagato") {
      setPendingAmount((p) => p - prezzo);
      setPendingCount((p) => p - 1);
      setFacturacionMes((p) => p + prezzo);
      setIscrittiCount((p) => p + 1);
    } else if (fromStato === "pagato" && toStato === "attesa") {
      setPendingAmount((p) => p + prezzo);
      setPendingCount((p) => p + 1);
      setFacturacionMes((p) => p - prezzo);
      setIscrittiCount((p) => Math.max(0, p - 1));
    }
  };

  const fetchKpiStudents = async (filter?: { stato: string }) => {
    setKpiLoading(true);
    setKpiStudentProfile(null);
    setKpiOcupacionDisciplina(null);
    let q = supabase.from("iscrizioni").select("id, nome, cognome, nome_alumna, cognome_alumna, disciplina_id, piano_id, stato, created_at, discipline(nome)").order("created_at", { ascending: false });
    if (filter) q = q.eq("stato", filter.stato);
    const [{ data: isc }, { data: piani }] = await Promise.all([q, supabase.from("piani").select("id, disciplina_id, prezzo")]);
    const pm: Record<string, number> = {};
    for (const p of (piani ?? []) as { id: string; disciplina_id: string; prezzo: number }[]) pm[`${p.id}:${p.disciplina_id}`] = p.prezzo;
    setKpiStudents(((isc ?? []) as unknown as KpiStudentRow[]).map((i) => ({ ...i, prezzo: pm[`${i.piano_id}:${i.disciplina_id}`] ?? null })));
    setKpiLoading(false);
  };

  const handleKpiStudentClick = async (id: string) => {
    setKpiLoading(true);
    const { data } = await supabase
      .from("iscrizioni")
      .select("id, nome, cognome, nome_alumna, cognome_alumna, email, telefono, stato, created_at, disciplina_id, piano_id, metodo_pagamento, discipline(nome), iscrizione_orari(orari(giorno, ora_inizio, ora_fine))")
      .eq("id", id).single();
    if (data) {
      const { data: pd } = await supabase.from("piani").select("prezzo").eq("id", (data as unknown as IscrizioneDetalle).piano_id).eq("disciplina_id", (data as unknown as IscrizioneDetalle).disciplina_id).single();
      setKpiStudentProfile({ ...(data as unknown as IscrizioneDetalle), prezzo: pd?.prezzo ?? null });
    }
    setKpiLoading(false);
  };

  const handleCambiarStatoKpi = async (nuevoStato: string) => {
    if (!kpiStudentProfile) return;
    const { error } = await supabase.from("iscrizioni").update({ stato: nuevoStato }).eq("id", kpiStudentProfile.id);
    if (!error) {
      ajustarMetrics(kpiStudentProfile, kpiStudentProfile.stato, nuevoStato);
      setKpiStudentProfile((p) => p ? { ...p, stato: nuevoStato } : p);
      setKpiStudents((prev) => prev.map((s) => s.id === kpiStudentProfile.id ? { ...s, stato: nuevoStato } : s));
    }
  };

  const handleUsuarioClick = async (id: string) => {
    setUsuariosProfileLoading(true);
    setUsuariosProfile(null);
    const { data } = await supabase
      .from("iscrizioni")
      .select("id, nome, cognome, nome_alumna, cognome_alumna, email, telefono, stato, created_at, disciplina_id, piano_id, metodo_pagamento, discipline(nome), iscrizione_orari(orari(giorno, ora_inizio, ora_fine))")
      .eq("id", id)
      .single();
    if (data) {
      const { data: pd } = await supabase.from("piani").select("prezzo").eq("id", (data as unknown as IscrizioneDetalle).piano_id).eq("disciplina_id", (data as unknown as IscrizioneDetalle).disciplina_id).single();
      setUsuariosProfile({ ...(data as unknown as IscrizioneDetalle), prezzo: pd?.prezzo ?? null });
    }
    setUsuariosProfileLoading(false);
  };

  const handleCambiarStatoUsuario = async (nuevoStato: string) => {
    if (!usuariosProfile) return;
    const { error } = await supabase.from("iscrizioni").update({ stato: nuevoStato }).eq("id", usuariosProfile.id);
    if (!error) {
      ajustarMetrics(usuariosProfile, usuariosProfile.stato, nuevoStato);
      setUsuariosProfile(p => p ? { ...p, stato: nuevoStato } : p);
      setUsuariosData(prev => prev.map(u => u.id === usuariosProfile.id ? { ...u, stato: nuevoStato } : u));
    }
  };

  const handleEliminarUsuario = async () => {
    if (!usuariosProfile) return;
    await supabase.from("iscrizione_orari").delete().eq("iscrizione_id", usuariosProfile.id);
    await supabase.from("iscrizioni").delete().eq("id", usuariosProfile.id);
    if (usuariosProfile.stato === "attesa") {
      setPendingCount(p => Math.max(0, p - 1));
      setPendingAmount(p => Math.max(0, p - (usuariosProfile.prezzo ?? 0)));
    } else if (usuariosProfile.stato === "pagato") {
      setIscrittiCount(p => Math.max(0, p - 1));
      setFacturacionMes(p => Math.max(0, p - (usuariosProfile.prezzo ?? 0)));
    }
    setBookings(prev => prev.filter(b => b.id !== usuariosProfile.id));
    setUsuariosData(prev => prev.filter(u => u.id !== usuariosProfile.id));
    setUsuariosProfile(null);
  };

  const handleKpiAlumnos = async () => {
    setKpiDrawer("alumnos");
    setKpiStudentProfile(null);
    setKpiAlumnosDisciplina(null);
    setKpiStudents([]);
    setKpiLoading(true);
    const { data: isc } = await supabase.from("iscrizioni").select("disciplina_id, discipline(nome)").eq("stato", "pagato");
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
    const [{ data: isc }, { data: piani }] = await Promise.all([
      supabase.from("iscrizioni").select("id, nome, cognome, nome_alumna, cognome_alumna, disciplina_id, piano_id, stato, created_at, discipline(nome)").eq("disciplina_id", disc.disciplina_id).eq("stato", "pagato").order("created_at", { ascending: false }),
      supabase.from("piani").select("id, disciplina_id, prezzo"),
    ]);
    const pm: Record<string, number> = {};
    for (const p of (piani ?? []) as { id: string; disciplina_id: string; prezzo: number }[]) pm[`${p.id}:${p.disciplina_id}`] = p.prezzo;
    setKpiStudents(((isc ?? []) as unknown as KpiStudentRow[]).map((i) => ({ ...i, prezzo: pm[`${i.piano_id}:${i.disciplina_id}`] ?? null })));
    setKpiLoading(false);
  };

  useEffect(() => {
    const todayEs = DOW_ES[new Date().getDay()];
    Promise.all([
      supabase.from("iscrizioni").select("*", { count: "exact", head: true }).eq("stato", "pagato"),
      supabase.from("orari").select("*", { count: "exact", head: true }).eq("giorno", todayEs).eq("attivo", true),
      supabase.from("iscrizioni").select("*", { count: "exact", head: true }).eq("stato", "attesa"),
      supabase.from("orari").select("id, giorno, ora_inizio, ora_fine, disciplina_id, posti_totali, discipline(nome), iscrizione_orari(iscrizione_id)").eq("attivo", true),
      supabase.from("iscrizioni").select("id, nome, cognome, nome_alumna, cognome_alumna, stato, created_at, discipline(nome), iscrizione_orari(orari(giorno, ora_inizio))").order("created_at", { ascending: false }).limit(5),
      supabase.from("iscrizioni").select("disciplina_id, piano_id, stato, created_at, matricula"),
      supabase.from("piani").select("id, disciplina_id, prezzo"),
    ]).then(([r1, r2, r3, r4, r5, r6, r7]) => {
      setIscrittiCount(r1.count ?? 0);
      setLezioniCount(r2.count ?? 0);
      setPendingCount(r3.count ?? 0);
      const orariData = (r4.data as unknown as AdminOrario[]) ?? [];
      setOrari(orariData);
      setBookings((r5.data as unknown as IscrzioneRow[]) ?? []);

      // Build price map: `${piano_id}:${disciplina_id}` → prezzo
      const pm: Record<string, number> = {};
      for (const p of (r7.data ?? []) as { id: string; disciplina_id: string; prezzo: number }[])
        pm[`${p.id}:${p.disciplina_id}`] = p.prezzo;

      const now2 = new Date();
      const tm = now2.getMonth(), ty = now2.getFullYear();
      const curMonthStr = `${ty}-${String(tm + 1).padStart(2, "0")}`;
      let factMes = 0, factAnt = 0, pendAmt = 0;
      for (const isc of (r6.data ?? []) as { disciplina_id: string; piano_id: string; stato: string; created_at: string }[]) {
        const prezzo = pm[`${isc.piano_id}:${isc.disciplina_id}`] ?? 0;
        if (isc.stato === "attesa") { pendAmt += prezzo; }
        if (isc.stato === "pagato") {
          factMes += prezzo;
          if (isc.created_at.substring(0, 7) < curMonthStr) factAnt += prezzo;
        }
      }
      setFacturacionMes(factMes);
      setFacturacionMesAnterior(factAnt);
      setPendingAmount(pendAmt);
      const matriculasEsteMes = ((r6.data ?? []) as { created_at: string; matricula: number }[])
        .filter(i => i.created_at.substring(0, 7) === curMonthStr)
        .reduce((s, i) => s + (i.matricula ?? 0), 0);
      setMatriculasMes(matriculasEsteMes);
      const nuevasEstesMes = ((r6.data ?? []) as { created_at: string }[]).filter(i => {
        const d = new Date(i.created_at);
        return d.getMonth() === tm && d.getFullYear() === ty;
      }).length;
      setNuevasInscripcionesMes(nuevasEstesMes);

      // Precio medio por alumna (sobre todas las pagato)
      const pagati = ((r6.data ?? []) as { disciplina_id: string; piano_id: string; stato: string }[]).filter(i => i.stato === "pagato");
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
  const pagadasMes = ventasMesFiltradas.filter(v => v.stato === "pagato");
  const ingresosMesV = pagadasMes.reduce((s, v) => s + (v.prezzo ?? 0), 0);
  const ingresosMesAntV = ventasPrevMes.filter(v => v.stato === "pagato").reduce((s, v) => s + (v.prezzo ?? 0), 0);
  const ingresosDiff = ingresosMesAntV > 0 ? ((ingresosMesV - ingresosMesAntV) / ingresosMesAntV) * 100 : null;
  const ticketMedioV = pagadasMes.length > 0 ? ingresosMesV / pagadasMes.length : 0;
  const pendientesCountV = ventasMesFiltradas.filter(v => v.stato === "attesa").length;
  const daysInMonth = new Date(vYear, vMonth, 0).getDate();
  const ventasChartData = ventasGranularity === "diario"
    ? Array.from({ length: daysInMonth }, (_, i) => {
        const dayStr = `${ventasMes}-${String(i + 1).padStart(2, "0")}`;
        const rows = ventasMesFiltradas.filter(v => v.created_at.startsWith(dayStr));
        return { label: String(i + 1), ingresos: rows.filter(v => v.stato === "pagato").reduce((s, v) => s + (v.prezzo ?? 0), 0), inscripciones: rows.length };
      })
    : [1, 2, 3, 4].map(w => {
        const start = (w - 1) * 7 + 1;
        const end = w === 4 ? daysInMonth : w * 7;
        const rows = ventasMesFiltradas.filter(v => { const d = new Date(v.created_at).getDate(); return d >= start && d <= end; });
        return { label: `Sem ${w}`, ingresos: rows.filter(v => v.stato === "pagato").reduce((s, v) => s + (v.prezzo ?? 0), 0), inscripciones: rows.length };
      });
  const discMap: Record<string, { nombre: string; ingresos: number; count: number }> = {};
  pagadasMes.forEach(v => {
    if (!discMap[v.disciplina_id]) discMap[v.disciplina_id] = { nombre: v.discipline?.nome ?? v.disciplina_id, ingresos: 0, count: 0 };
    discMap[v.disciplina_id].ingresos += v.prezzo ?? 0;
    discMap[v.disciplina_id].count++;
  });
  const discBreakdown = Object.values(discMap).sort((a, b) => b.ingresos - a.ingresos);
  const maxDisc = Math.max(...discBreakdown.map(d => d.ingresos), 1);
  const planMapV: Record<string, { nombre: string; ingresos: number; count: number }> = {};
  pagadasMes.forEach(v => {
    if (!planMapV[v.piano_id]) planMapV[v.piano_id] = { nombre: PLAN_LABEL[v.piano_id] ?? v.piano_id, ingresos: 0, count: 0 };
    planMapV[v.piano_id].ingresos += v.prezzo ?? 0;
    planMapV[v.piano_id].count++;
  });
  const planBreakdownV = Object.values(planMapV).sort((a, b) => b.ingresos - a.ingresos);
  const maxPlan = Math.max(...planBreakdownV.map(p => p.ingresos), 1);

  const navItems = [
    { icon: "dashboard", label: "Resumen" },
    { icon: "calendar_month", label: "Calendario" },
    { icon: "group", label: "Usuarios" },
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
          {[
            { icon: "settings", label: "Configuración" },
            { icon: "help_outline", label: "Soporte" },
          ].map((item) => (
            <li key={item.label}>
              <a
                href="#"
                className="flex items-center px-4 py-3 rounded-xl text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors duration-200 font-label-md text-label-md md:py-2.5 md:px-3 md:rounded-lg md:text-sm"
              >
                <Icon name={item.icon} className="mr-3 md:mr-2.5 md:text-[18px]" />
                {item.label}
              </a>
            </li>
          ))}
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

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">

                {/* Total Alumnos */}
                <button
                  onClick={handleKpiAlumnos}
                  className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-surface-container-high text-left hover:shadow-md transition-shadow flex flex-col justify-between min-h-[140px]"
                >
                  <div className="flex justify-between items-start mb-3">
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#89726c" }}>Total Alumnos</p>
                    <div className="p-2 bg-secondary-container rounded-full text-on-secondary-container">
                      <Icon name="group" className="text-base" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold" style={{ color: "#7d2b13" }}>{loading ? "—" : iscrittiCount}</p>
                  <p className="text-xs mt-2" style={{ color: "#89726c" }}>Alumnas con pago activo →</p>
                </button>

                {/* Facturación Mes */}
                <div className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-surface-container-high flex flex-col justify-between min-h-[140px]">
                  <div className="flex justify-between items-start mb-3">
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#89726c" }}>Facturación Mes</p>
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
                    ) : <span>Inscripciones pagadas</span>}
                  </p>
                </div>

                {/* Interesadas */}
                <button
                  onClick={() => { setKpiDrawer("pendientes"); fetchKpiStudents({ stato: "attesa" }); }}
                  className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-surface-container-high text-left hover:shadow-md transition-shadow flex flex-col justify-between min-h-[140px]"
                >
                  <div className="flex justify-between items-start mb-3">
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#89726c" }}>Interesadas</p>
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
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#89726c" }}>Ocupación Media</p>
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
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#89726c" }}>Resultado Mes</p>
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
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#89726c" }}>Nuevas Inscripciones</p>
                    <div className="p-2 bg-primary-container rounded-full text-on-primary-container">
                      <Icon name="person_add" className="text-base" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold" style={{ color: "#7d2b13" }}>{loading ? "—" : nuevasInscripcionesMes}</p>
                  <p className="text-xs mt-2" style={{ color: "#89726c" }}>
                    {new Date().toLocaleDateString("es-ES", { month: "long" })}
                  </p>
                </div>

                {/* Matrículas */}
                <div className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-surface-container-high flex flex-col justify-between min-h-[140px]">
                  <div className="flex justify-between items-start mb-3">
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#89726c" }}>Matrículas</p>
                    <div className="p-2 bg-primary-container rounded-full text-on-primary-container">
                      <Icon name="school" className="text-base" />
                    </div>
                  </div>
                  <p className="text-3xl font-bold" style={{ color: "#7d2b13" }}>{loading ? "—" : `${matriculasMes}€`}</p>
                  <p className="text-xs mt-2" style={{ color: "#89726c" }}>
                    {nuevasInscripcionesMes > 0 ? `${nuevasInscripcionesMes} nueva${nuevasInscripcionesMes !== 1 ? "s" : ""} · pago único` : "Sin nuevas altas"}
                  </p>
                </div>

                {/* Objetivo Alumnos */}
                <div className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-surface-container-high flex flex-col justify-between min-h-[140px]">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#89726c" }}>Objetivo Alumnos</p>
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
                                  {v.stato === "pagato"
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
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#89726c" }}>Resultado Mes</p>
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
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#89726c" }}>Margen</p>
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
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#89726c" }}>Resultado YTD</p>
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
                    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#89726c" }}>Costes Fijos</p>
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
                <p className="text-sm font-semibold mb-6" style={{ color: "#7d2b13" }}>Ingresos vs Costes — últimos 6 meses</p>
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
                  <p className="text-sm font-semibold" style={{ color: "#7d2b13" }}>P&L Mensual — {new Date().getFullYear()}</p>
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
          {activeSection === "Usuarios" && (() => {
            const q = usuariosSearch.toLowerCase();
            const filtered = usuariosData.filter(u => {
              if (!q) return true;
              const name = NINAS_IDS.has(u.disciplina_id) && u.nome_alumna
                ? `${u.nome_alumna} ${u.cognome_alumna ?? ""}`.toLowerCase()
                : `${u.nome} ${u.cognome}`.toLowerCase();
              return name.includes(q) || (u.discipline?.nome ?? "").toLowerCase().includes(q);
            });
            return (
              <section className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-headline-md text-headline-md text-primary">Usuarios</h3>
                    <p className="text-xs mt-0.5" style={{ color: "#89726c" }}>{usuariosLoading ? "Cargando..." : `${usuariosData.length} alumna${usuariosData.length !== 1 ? "s" : ""} registradas`}</p>
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
                            {["Alumna", "Tutor", "Disciplina", "Plan", "Cuota", "Estado", "Inscrita"].map(h => (
                              <th key={h} className="text-left py-3 px-4 text-xs uppercase tracking-widest font-semibold" style={{ color: "#89726c" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.length === 0 ? (
                            <tr><td colSpan={7} className="py-12 text-center text-sm" style={{ color: "#89726c" }}>No hay resultados</td></tr>
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
                                  {u.stato === "attesa"
                                    ? <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-error-container text-on-error-container text-xs font-semibold">Pendiente</span>
                                    : <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: "#e8f5e9", color: "#2e7d32" }}>Pagado</span>}
                                </td>
                                <td className="py-3 px-4 whitespace-nowrap text-xs" style={{ color: "#89726c" }}>
                                  {new Date(u.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
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
              <table className="w-full text-left border-collapse min-w-[540px]">
                <thead className="bg-surface-container-low border-b border-outline-variant">
                  <tr>
                    <th className="py-4 px-4 md:px-6 font-label-md text-label-md text-on-surface-variant">Usuario</th>
                    <th className="py-4 px-4 md:px-6 font-label-md text-label-md text-on-surface-variant">Disciplina</th>
                    <th className="py-4 px-4 md:px-6 font-label-md text-label-md text-on-surface-variant">Fecha</th>
                    <th className="py-4 px-4 md:px-6 font-label-md text-label-md text-on-surface-variant">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/50">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-on-surface-variant">Cargando...</td>
                    </tr>
                  ) : bookings.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-on-surface-variant font-body-md text-body-md">
                        No hay reservas aún
                      </td>
                    </tr>
                  ) : (
                    bookings.map((b) => (
                      <tr key={b.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="py-4 px-4 md:px-6 font-body-md text-body-md text-on-surface">
                          <span>{b.nome} {b.cognome}</span>
                          {b.nome_alumna && (
                            <span className="block text-xs mt-0.5" style={{ color: "#89726c" }}>
                              Alumna: {b.nome_alumna} {b.cognome_alumna}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-4 md:px-6 font-body-md text-body-md text-on-surface">
                          {b.discipline?.nome ?? "—"}
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
                    : kpiDrawer === "alumnos" ? "Alumnas Activas"
                    : "Ocupación por Disciplina"}
                </p>
                <p className="text-xs" style={{ color: "#89726c" }}>
                  {kpiStudentProfile ? "Perfil"
                    : kpiOcupacionDisciplina ? "Clases"
                    : kpiDrawer === "pendientes" ? `${pendingCount} contacto${pendingCount !== 1 ? "s" : ""} · ${pendingAmount}€ potencial`
                    : kpiDrawer === "alumnos" && kpiAlumnosDisciplina ? `${kpiStudents.length} alumna${kpiStudents.length !== 1 ? "s" : ""}`
                    : kpiDrawer === "alumnos" ? `${iscrittiCount} alumna${iscrittiCount !== 1 ? "s" : ""} activas`
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
                    <div className="flex items-center justify-between p-4">
                      <p className="text-sm font-medium" style={{ color: "#25190f" }}>Estado de pago</p>
                      {kpiStudentProfile.stato === "attesa"
                        ? <span className="px-3 py-1 rounded-full text-xs font-semibold bg-error-container text-on-error-container">Pendiente</span>
                        : <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: "#e8f5e9", color: "#2e7d32" }}>Pagado</span>}
                    </div>
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
                    <div className="flex items-center justify-between p-4">
                      <p className="text-sm font-medium" style={{ color: "#25190f" }}>Estado de pago</p>
                      {drawerDetalle.stato === "attesa" ? (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-error-container text-on-error-container">Pendiente</span>
                      ) : (
                        <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: "#e8f5e9", color: "#2e7d32" }}>Pagado</span>
                      )}
                    </div>
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
                      <p className="text-sm break-all" style={{ color: "#25190f" }}>{usuariosProfile.email}</p>
                    </div>
                    {usuariosProfile.telefono && (
                      <div className="flex items-center gap-3 p-3 rounded-xl border" style={{ borderColor: "#dcc1b9" }}>
                        <Icon name="phone" className="text-base" style={{ color: "#7d2b13" }} />
                        <p className="text-sm" style={{ color: "#25190f" }}>{usuariosProfile.telefono}</p>
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

                  {/* Estado de pago */}
                  <div className="rounded-xl border overflow-hidden" style={{ borderColor: "#dcc1b9" }}>
                    <div className="flex items-center justify-between p-4">
                      <p className="text-sm font-medium" style={{ color: "#25190f" }}>Estado de pago</p>
                      {usuariosProfile.stato === "attesa"
                        ? <span className="px-3 py-1 rounded-full text-xs font-semibold bg-error-container text-on-error-container">Pendiente</span>
                        : <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: "#e8f5e9", color: "#2e7d32" }}>Pagado</span>}
                    </div>
                    {usuariosProfile.stato === "attesa" ? (
                      <button onClick={() => handleCambiarStatoUsuario("pagato")} className="w-full py-3 text-sm font-semibold border-t" style={{ borderColor: "#dcc1b9", backgroundColor: "#7d2b13", color: "#fff" }}>
                        Marcar como pagado
                      </button>
                    ) : (
                      <button onClick={() => handleCambiarStatoUsuario("attesa")} className="w-full py-3 text-sm font-semibold border-t" style={{ borderColor: "#dcc1b9", backgroundColor: "#fff1e9", color: "#89726c" }}>
                        Deshacer pago
                      </button>
                    )}
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
