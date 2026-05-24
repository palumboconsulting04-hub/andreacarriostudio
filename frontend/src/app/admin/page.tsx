"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [iscrittiCount, setIscrittiCount] = useState(0);
  const [lezioniCount, setLezioniCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [orari, setOrari] = useState<AdminOrario[]>([]);
  const [bookings, setBookings] = useState<IscrzioneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // KPI metrics
  const [facturacionMes, setFacturacionMes] = useState(0);
  const [facturacionMesAnterior, setFacturacionMesAnterior] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [ocupacionMedia, setOcupacionMedia] = useState(0);
  const [ocupacionDisciplinas, setOcupacionDisciplinas] = useState<OcupacionDisciplina[]>([]);

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
      supabase.from("iscrizioni").select("*", { count: "exact", head: true }),
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

  const ajustarMetrics = (iscrizione: { created_at: string; prezzo?: number | null }, fromStato: string, toStato: string) => {
    const prezzo = iscrizione.prezzo ?? 0;
    const now = new Date();
    const d = new Date(iscrizione.created_at);
    const isThisMonth = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (fromStato === "attesa" && toStato === "pagato") {
      setPendingAmount((p) => p - prezzo);
      setPendingCount((p) => p - 1);
      if (isThisMonth) setFacturacionMes((p) => p + prezzo);
    } else if (fromStato !== "attesa" && toStato === "attesa") {
      setPendingAmount((p) => p + prezzo);
      setPendingCount((p) => p + 1);
      if (isThisMonth) setFacturacionMes((p) => p - prezzo);
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

  const handleKpiAlumnos = async () => {
    setKpiDrawer("alumnos");
    setKpiStudentProfile(null);
    setKpiAlumnosDisciplina(null);
    setKpiStudents([]);
    setKpiLoading(true);
    const { data: isc } = await supabase.from("iscrizioni").select("disciplina_id, discipline(nome)");
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
      supabase.from("iscrizioni").select("id, nome, cognome, nome_alumna, cognome_alumna, disciplina_id, piano_id, stato, created_at, discipline(nome)").eq("disciplina_id", disc.disciplina_id).order("created_at", { ascending: false }),
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
      supabase.from("iscrizioni").select("*", { count: "exact", head: true }),
      supabase.from("orari").select("*", { count: "exact", head: true }).eq("giorno", todayEs).eq("attivo", true),
      supabase.from("iscrizioni").select("*", { count: "exact", head: true }).eq("stato", "attesa"),
      supabase.from("orari").select("id, giorno, ora_inizio, ora_fine, disciplina_id, posti_totali, discipline(nome), iscrizione_orari(iscrizione_id)").eq("attivo", true),
      supabase.from("iscrizioni").select("id, nome, cognome, nome_alumna, cognome_alumna, stato, created_at, discipline(nome), iscrizione_orari(orari(giorno, ora_inizio))").order("created_at", { ascending: false }).limit(5),
      supabase.from("iscrizioni").select("disciplina_id, piano_id, stato, created_at"),
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
      const pm2 = tm === 0 ? 11 : tm - 1, py = tm === 0 ? ty - 1 : ty;
      let factMes = 0, factAnt = 0, pendAmt = 0;
      for (const isc of (r6.data ?? []) as { disciplina_id: string; piano_id: string; stato: string; created_at: string }[]) {
        const prezzo = pm[`${isc.piano_id}:${isc.disciplina_id}`] ?? 0;
        if (isc.stato === "attesa") { pendAmt += prezzo; }
        if (isc.stato === "pagato") {
          const d = new Date(isc.created_at);
          if (d.getMonth() === tm && d.getFullYear() === ty) factMes += prezzo;
          if (d.getMonth() === pm2 && d.getFullYear() === py) factAnt += prezzo;
        }
      }
      setFacturacionMes(factMes);
      setFacturacionMesAnterior(factAnt);
      setPendingAmount(pendAmt);

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

  const navItems = [
    { icon: "calendar_month", label: "Calendario", active: true },
    { icon: "event_seat", label: "Reservas", active: false },
    { icon: "fitness_center", label: "Disciplinas", active: false },
    { icon: "group", label: "Usuarios", active: false },
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
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        {/* Close button (mobile only) */}
        <button
          className="absolute top-4 right-4 md:hidden text-on-surface-variant"
          onClick={() => setSidebarOpen(false)}
          aria-label="Cerrar menú"
        >
          <Icon name="close" />
        </button>

        <div className="mb-stack-lg flex flex-col items-center">
          <Image
            src="/logo.png"
            alt="Logo Andrea Carrió Studio"
            width={96}
            height={96}
            className="rounded-full object-cover mb-4"
          />
          <h1 className="font-display-lg text-2xl font-semibold text-primary text-center tracking-tight">
            Studio Admin
          </h1>
          <p className="font-label-md text-label-md text-on-surface-variant">Gestión del Estudio</p>
        </div>

        <button className="bg-primary text-on-primary rounded-full py-3 px-6 mb-stack-md font-label-md text-label-md hover:bg-secondary transition-colors">
          Nueva Clase
        </button>

        <ul className="flex-1 space-y-2">
          {navItems.map((item) => (
            <li key={item.label}>
              <a
                href="#"
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center px-4 py-3 rounded-lg transition-all font-label-md text-label-md ${
                  item.active
                    ? "text-primary border-r-4 border-primary bg-surface-container-highest font-bold scale-95"
                    : "text-on-surface-variant hover:text-primary hover:bg-surface-container-high duration-200"
                }`}
              >
                <Icon name={item.icon} className="mr-3" />
                {item.label}
              </a>
            </li>
          ))}
        </ul>

        <ul className="mt-auto space-y-2 border-t border-outline-variant pt-4">
          {[
            { icon: "settings", label: "Configuración" },
            { icon: "help_outline", label: "Soporte" },
          ].map((item) => (
            <li key={item.label}>
              <a
                href="#"
                className="flex items-center px-4 py-3 rounded-lg text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors duration-200 font-label-md text-label-md"
              >
                <Icon name={item.icon} className="mr-3" />
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Main ── */}
      <div className="flex-1 flex flex-col min-h-screen md:ml-64">

        {/* Top bar */}
        <header className="bg-surface/80 backdrop-blur-md border-b border-outline-variant fixed top-0 left-0 right-0 md:left-64 h-16 shadow-sm flex justify-between items-center px-4 md:px-margin-desktop z-40">
          {/* Hamburger (mobile only) */}
          <button
            className="md:hidden p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
          >
            <Icon name="menu" />
          </button>

          <h2 className="font-title-lg text-title-lg text-secondary hidden md:block">
            Panel de Administración
          </h2>
          <p className="font-title-lg text-title-lg text-secondary md:hidden text-sm">
            Studio Admin
          </p>

          <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-semibold text-sm border-2 border-surface-container-high">
            AC
          </div>
        </header>

        {/* Content */}
        <main className="pt-[80px] p-4 md:p-margin-desktop flex-1 overflow-y-auto space-y-section-gap">

          {/* ── KPI Cards ── */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">

            {/* Total Alumnos */}
            <button
              onClick={handleKpiAlumnos}
              className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-surface-container-high text-left hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div className="flex justify-between items-start mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#89726c" }}>Total Alumnos</p>
                <div className="p-2 bg-secondary-container rounded-full text-on-secondary-container">
                  <Icon name="group" className="text-base" />
                </div>
              </div>
              <p className="text-3xl font-bold" style={{ color: "#7d2b13" }}>{loading ? "—" : iscrittiCount}</p>
              <p className="text-xs mt-2" style={{ color: "#89726c" }}>Ver listado →</p>
            </button>

            {/* Facturación Mensual */}
            <div className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-surface-container-high flex flex-col justify-between">
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
                      {facturacionMesAnterior > 0 ? Math.round(((facturacionMes - facturacionMesAnterior) / facturacionMesAnterior) * 100) : 0}%
                    </span>
                  </>
                ) : <span>Nuevas inscripciones pagadas</span>}
              </p>
            </div>

            {/* Pagos Pendientes */}
            <button
              onClick={() => { setKpiDrawer("pendientes"); fetchKpiStudents({ stato: "attesa" }); }}
              className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-surface-container-high text-left hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div className="flex justify-between items-start mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#89726c" }}>Pagos Pendientes</p>
                <div className="p-2 bg-error-container rounded-full text-on-error-container">
                  <Icon name="payments" className="text-base" />
                </div>
              </div>
              <p className="text-3xl font-bold text-error">{loading ? "—" : pendingCount}</p>
              <p className="text-xs mt-2" style={{ color: "#89726c" }}>
                {loading ? "—" : `${pendingAmount}€ por cobrar →`}
              </p>
            </button>

            {/* Ocupación Media */}
            <button
              onClick={() => { setKpiDrawer("ocupacion"); setKpiStudentProfile(null); setKpiOcupacionDisciplina(null); }}
              className="bg-surface-container-lowest rounded-[24px] p-5 shadow-sm border border-surface-container-high text-left hover:shadow-md transition-shadow flex flex-col justify-between"
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

          </section>

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
                    : kpiDrawer === "pendientes" ? "Pagos Pendientes"
                    : kpiDrawer === "alumnos" ? "Todos los Alumnos"
                    : "Ocupación por Disciplina"}
                </p>
                <p className="text-xs" style={{ color: "#89726c" }}>
                  {kpiStudentProfile ? "Perfil"
                    : kpiOcupacionDisciplina ? "Clases"
                    : kpiDrawer === "pendientes" ? `${pendingCount} alumnos · ${pendingAmount}€`
                    : kpiDrawer === "alumnos" && kpiAlumnosDisciplina ? `${kpiStudents.length} alumno${kpiStudents.length !== 1 ? "s" : ""}`
                    : kpiDrawer === "alumnos" ? `${iscrittiCount} alumnos`
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

    </div>
  );
}
