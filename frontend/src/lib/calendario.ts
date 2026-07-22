import { supabaseAdmin } from "@/lib/supabase-admin";

// Genera las clases con fecha (instancias del horario semanal) de las próximas
// semanas, con plazas reales = capacidad − mensuales fijas − reservas de bono.
// Lo usan el panel de la alumna y la vista previa del admin.

const DIAS: Record<string, number> = {
  "Domingo": 0, "Lunes": 1, "Martes": 2, "Miércoles": 3, "Miercoles": 3,
  "Jueves": 4, "Viernes": 5, "Sábado": 6, "Sabado": 6,
};
const HORIZON_DIAS = 28;          // por defecto (vista previa pública): 4 semanas
const HORIZON_MAX = 100;          // tope de seguridad (~3 meses, el bono más largo)
const pad = (n: number) => String(n).padStart(2, "0");
const horaMin = (t: string) => { const [h, m] = t.split(":"); return (+h) * 60 + (+m); };

export type Clase = {
  orario_id: string; disciplina_id: string; fecha: string; dia: string;
  hora: string; horaFin: string; libres: number; tope: number; reserva_id: string | null;
};

type OrarioRow = { id: string; disciplina_id: string; giorno: string; ora_inizio: string; ora_fine: string; posti_totali: number };

// `hasta` (YYYY-MM-DD, opcional): última fecha a generar — normalmente la caducidad
// del bono, para que la alumna pueda reservar en toda la validez, no solo 4 semanas.
export async function generarClases(disciplinas: string[], hasta?: string): Promise<Clase[]> {
  if (disciplinas.length === 0) return [];
  const hoy = new Date().toISOString().slice(0, 10);

  const { data: orariData } = await supabaseAdmin
    .from("orari")
    .select("id, disciplina_id, giorno, ora_inizio, ora_fine, posti_totali")
    .in("disciplina_id", disciplinas)
    .eq("attivo", true);
  const orari = (orariData ?? []) as OrarioRow[];
  const orarioIds = orari.map(o => o.id);
  if (orarioIds.length === 0) return [];

  const mensuales: Record<string, number> = {};
  {
    const { data: io } = await supabaseAdmin.from("iscrizione_orari").select("orario_id").in("orario_id", orarioIds);
    for (const r of (io ?? []) as { orario_id: string }[]) mensuales[r.orario_id] = (mensuales[r.orario_id] ?? 0) + 1;
  }

  const bonoCount: Record<string, number> = {};
  {
    const { data: rc } = await supabaseAdmin.from("reservas_clase").select("orario_id, fecha").in("orario_id", orarioIds).gte("fecha", hoy);
    for (const r of (rc ?? []) as { orario_id: string; fecha: string }[]) {
      const k = `${r.orario_id}|${r.fecha}`;
      bonoCount[k] = (bonoCount[k] ?? 0) + 1;
    }
  }

  const nowMadrid = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
  const nowMinutes = nowMadrid.getHours() * 60 + nowMadrid.getMinutes();
  const start = new Date(nowMadrid); start.setHours(0, 0, 0, 0);

  let horizon = HORIZON_DIAS;
  if (hasta) {
    const diff = Math.round((new Date(hasta + "T00:00").getTime() - start.getTime()) / 86400000);
    horizon = Math.max(0, Math.min(HORIZON_MAX, diff));
  }

  const clases: Clase[] = [];
  for (let i = 0; i <= horizon; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const dow = d.getDay();
    const fecha = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    for (const o of orari) {
      if (DIAS[o.giorno] !== dow) continue;
      if (i === 0 && horaMin(o.ora_inizio) <= nowMinutes) continue; // hoy: oculta solo las que YA han empezado
      const k = `${o.id}|${fecha}`;
      const ocup = (mensuales[o.id] ?? 0) + (bonoCount[k] ?? 0);
      clases.push({
        orario_id: o.id, disciplina_id: o.disciplina_id, fecha, dia: o.giorno,
        hora: o.ora_inizio.slice(0, 5), horaFin: o.ora_fine.slice(0, 5),
        libres: Math.max(0, o.posti_totali - ocup), tope: o.posti_totali, reserva_id: null,
      });
    }
  }
  clases.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  return clases;
}

const CURSO_INICIO = "2026-09-01"; // las clases de mensualidad arrancan el 1 de septiembre
const HORIZON_MENSUAL = 42;        // muestra ~6 semanas de clases fijas

export type ClaseMensual = {
  iscrizione_id: string; orario_id: string; disciplina_id: string;
  fecha: string; dia: string; hora: string; horaFin: string;
  avisado: boolean; motivo: string | null;
};

// Clases FIJAS de las mensualidades de una alumna (sus horarios de la inscripción,
// proyectados a fechas), con la marca de si ya avisó que un día no puede ir. No elige
// nada: solo ve sus clases y puede avisar de una ausencia puntual.
export async function clasesDeMensualidad(email: string): Promise<ClaseMensual[]> {
  const INSCRITA = ["pagato", "pagado", "activa", "matricula_pagada"];
  const { data: iscr } = await supabaseAdmin
    .from("iscrizioni").select("id").ilike("email", email).in("stato", INSCRITA);
  const iscrIds = (iscr ?? []).map((i) => i.id as string);
  if (iscrIds.length === 0) return [];

  const { data: io } = await supabaseAdmin
    .from("iscrizione_orari").select("iscrizione_id, orario_id").in("iscrizione_id", iscrIds);
  const links = (io ?? []) as { iscrizione_id: string; orario_id: string }[];
  const orarioIds = [...new Set(links.map((l) => l.orario_id))];
  if (orarioIds.length === 0) return [];

  const { data: orariData } = await supabaseAdmin
    .from("orari").select("id, disciplina_id, giorno, ora_inizio, ora_fine").in("id", orarioIds).eq("attivo", true);
  const orari = new Map((orariData ?? []).map((o) => [o.id as string, o as OrarioRow]));

  const { data: marks } = await supabaseAdmin
    .from("asistencia").select("iscrizione_id, orario_id, fecha, nota").in("iscrizione_id", iscrIds).eq("estado", "no_viene");
  const aviso = new Map((marks ?? []).map((m) => [`${m.iscrizione_id}|${m.orario_id}|${m.fecha}`, m.nota as string | null]));

  const hoyStr = new Date().toISOString().slice(0, 10);
  const startStr = hoyStr < CURSO_INICIO ? CURSO_INICIO : hoyStr;
  const start = new Date(startStr + "T00:00"); start.setHours(0, 0, 0, 0);

  const clases: ClaseMensual[] = [];
  for (const l of links) {
    const o = orari.get(l.orario_id);
    if (!o) continue;
    for (let i = 0; i <= HORIZON_MENSUAL; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      if (DIAS[o.giorno] !== d.getDay()) continue;
      const fecha = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const key = `${l.iscrizione_id}|${o.id}|${fecha}`;
      clases.push({
        iscrizione_id: l.iscrizione_id, orario_id: o.id, disciplina_id: o.disciplina_id,
        fecha, dia: o.giorno, hora: o.ora_inizio.slice(0, 5), horaFin: o.ora_fine.slice(0, 5),
        avisado: aviso.has(key), motivo: aviso.get(key) ?? null,
      });
    }
  }
  clases.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  return clases;
}
