"use client";

import { useState, useEffect } from "react";
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
  iscrizione_orari: { orario_id: string }[];
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

// ─── Constants ────────────────────────────────────────────────────────────────

const DOW_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const DAYS_SHORT_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const GIORNI = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];

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

function Icon({ name, className = "" }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [iscrittiCount, setIscrittiCount] = useState(0);
  const [lezioniCount, setLezioniCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [orari, setOrari] = useState<AdminOrario[]>([]);
  const [bookings, setBookings] = useState<IscrzioneRow[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    const todayEs = DOW_ES[new Date().getDay()];
    Promise.all([
      supabase.from("iscrizioni").select("*", { count: "exact", head: true }),
      supabase.from("orari").select("*", { count: "exact", head: true }).eq("giorno", todayEs).eq("attivo", true),
      supabase.from("iscrizioni").select("*", { count: "exact", head: true }).eq("stato", "attesa"),
      supabase.from("orari").select("id, giorno, ora_inizio, ora_fine, disciplina_id, posti_totali, discipline(nome), iscrizione_orari(orario_id)").eq("attivo", true),
      supabase
        .from("iscrizioni")
        .select("id, nome, cognome, nome_alumna, cognome_alumna, stato, created_at, discipline(nome), iscrizione_orari(orari(giorno, ora_inizio))")
        .order("created_at", { ascending: false })
        .limit(5),
    ]).then(([r1, r2, r3, r4, r5]) => {
      setIscrittiCount(r1.count ?? 0);
      setLezioniCount(r2.count ?? 0);
      setPendingCount(r3.count ?? 0);
      setOrari((r4.data as unknown as AdminOrario[]) ?? []);
      setBookings((r5.data as unknown as IscrzioneRow[]) ?? []);
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

  return (
    <div className="bg-background text-on-background font-body-md min-h-screen flex">

      {/* ── Sidebar ── */}
      <nav className="bg-surface-container-low text-primary h-screen w-64 fixed left-0 top-0 border-r border-outline-variant flex flex-col py-gutter px-4 z-50">
        <div className="mb-stack-lg flex flex-col items-center">
          <Image
            src="/logo.png"
            alt="Logo Andrea Carrió Studio"
            width={96}
            height={96}
            className="rounded-full object-cover mb-4"
          />
          <h1
            className="font-display-lg text-2xl font-semibold text-primary text-center tracking-tight"
          >
            Studio Admin
          </h1>
          <p className="font-label-md text-label-md text-on-surface-variant">Gestión del Estudio</p>
        </div>

        <button className="bg-primary text-on-primary rounded-full py-3 px-6 mb-stack-md font-label-md text-label-md hover:bg-secondary transition-colors">
          Nueva Clase
        </button>

        <ul className="flex-1 space-y-2">
          {[
            { icon: "calendar_month", label: "Calendario", active: true },
            { icon: "event_seat", label: "Reservas", active: false },
            { icon: "fitness_center", label: "Disciplinas", active: false },
            { icon: "group", label: "Usuarios", active: false },
          ].map((item) => (
            <li key={item.label}>
              <a
                href="#"
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
      <div className="ml-64 flex-1 flex flex-col min-h-screen">

        {/* Top bar */}
        <header className="bg-surface/80 backdrop-blur-md border-b border-outline-variant fixed top-0 right-0 w-[calc(100%-16rem)] h-16 shadow-sm flex justify-between items-center px-margin-desktop z-40">
          <h2 className="font-title-lg text-title-lg text-secondary">
            Panel de Administración
          </h2>
          <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-semibold text-sm border-2 border-surface-container-high">
            AC
          </div>
        </header>

        {/* Content */}
        <main className="pt-[80px] p-margin-desktop flex-1 overflow-y-auto space-y-section-gap">

          {/* ── Stats ── */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Totale iscritti */}
            <div className="bg-surface-container-lowest rounded-[24px] p-6 shadow-sm shadow-[#3D2B1F]/5 flex flex-col justify-between border border-surface-container-high">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-label-md text-label-md text-on-surface-variant mb-1">Total Inscritos</p>
                  <h3 className="font-headline-md text-headline-md text-primary">
                    {loading ? "—" : iscrittiCount}
                  </h3>
                </div>
                <div className="p-3 bg-secondary-container rounded-full text-on-secondary-container">
                  <Icon name="group" />
                </div>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant mt-4 text-sm">
                <span className="text-secondary font-semibold">+{loading ? "—" : iscrittiCount}</span> total registrados
              </p>
            </div>

            {/* Lezioni odierne */}
            <div className="bg-surface-container-lowest rounded-[24px] p-6 shadow-sm shadow-[#3D2B1F]/5 flex flex-col justify-between border border-surface-container-high">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-label-md text-label-md text-on-surface-variant mb-1">Clases de Hoy</p>
                  <h3 className="font-headline-md text-headline-md text-primary">
                    {loading ? "—" : lezioniCount}
                  </h3>
                </div>
                <div className="p-3 bg-primary-container rounded-full text-on-primary-container">
                  <Icon name="event" />
                </div>
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant mt-4 text-sm">
                <span className="text-secondary font-semibold">{loading ? "—" : lezioniCount}</span> clases programadas hoy
              </p>
            </div>

            {/* Pagamenti in sospeso */}
            <div className="bg-surface-container-lowest rounded-[24px] p-6 shadow-sm shadow-[#3D2B1F]/5 flex flex-col justify-between border border-surface-container-high">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-label-md text-label-md text-on-surface-variant mb-1">Pagos Pendientes</p>
                  <h3 className="font-headline-md text-headline-md text-error">
                    {loading ? "—" : pendingCount}
                  </h3>
                </div>
                <div className="p-3 bg-error-container rounded-full text-on-error-container">
                  <Icon name="payments" />
                </div>
              </div>
              <button className="mt-4 text-left font-label-md text-label-md text-secondary hover:text-primary transition-colors">
                Ver detalles →
              </button>
            </div>
          </section>

          {/* ── Calendario ── */}
          <section>
            <h3 className="font-headline-md text-headline-md text-primary mb-stack-md">
              Calendario Semanal
            </h3>
            <div className="bg-surface-container-lowest rounded-[24px] p-6 shadow-sm shadow-[#3D2B1F]/5 border border-surface-container-high overflow-x-auto">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div
                    className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: "#7d2b13", borderTopColor: "transparent" }}
                  />
                </div>
              ) : (
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
              <table className="w-full text-left border-collapse">
                <thead className="bg-surface-container-low border-b border-outline-variant">
                  <tr>
                    <th className="py-4 px-6 font-label-md text-label-md text-on-surface-variant">Usuario</th>
                    <th className="py-4 px-6 font-label-md text-label-md text-on-surface-variant">Disciplina</th>
                    <th className="py-4 px-6 font-label-md text-label-md text-on-surface-variant">Fecha Inscripción</th>
                    <th className="py-4 px-6 font-label-md text-label-md text-on-surface-variant">Estado de Pago</th>
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
                        <td className="py-4 px-6 font-body-md text-body-md text-on-surface">
                          <span>{b.nome} {b.cognome}</span>
                          {b.nome_alumna && (
                            <span className="block text-xs mt-0.5" style={{ color: "#89726c" }}>
                              Alumna: {b.nome_alumna} {b.cognome_alumna}
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-6 font-body-md text-body-md text-on-surface">
                          {b.discipline?.nome ?? "—"}
                        </td>
                        <td className="py-4 px-6 font-body-md text-body-md text-on-surface-variant">
                          {formatData(b.created_at)}
                        </td>
                        <td className="py-4 px-6">
                          {b.stato === "attesa" ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-error-container text-on-error-container font-label-md text-xs">
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
          </section>

        </main>
      </div>
    </div>
  );
}
