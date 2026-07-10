import { supabaseAdmin } from "@/lib/supabase-admin";

// Genera las clases con fecha (instancias del horario semanal) de las próximas
// semanas, con plazas reales = capacidad − mensuales fijas − reservas de bono.
// Lo usan el panel de la alumna y la vista previa del admin.

const DIAS: Record<string, number> = {
  "Domingo": 0, "Lunes": 1, "Martes": 2, "Miércoles": 3, "Miercoles": 3,
  "Jueves": 4, "Viernes": 5, "Sábado": 6, "Sabado": 6,
};
const HORIZON_DIAS = 28;
const pad = (n: number) => String(n).padStart(2, "0");
const horaMin = (t: string) => { const [h, m] = t.split(":"); return (+h) * 60 + (+m); };

export type Clase = {
  orario_id: string; disciplina_id: string; fecha: string; dia: string;
  hora: string; horaFin: string; libres: number; tope: number; reserva_id: string | null;
};

type OrarioRow = { id: string; disciplina_id: string; giorno: string; ora_inizio: string; ora_fine: string; posti_totali: number };

export async function generarClases(disciplinas: string[]): Promise<Clase[]> {
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

  const clases: Clase[] = [];
  for (let i = 0; i <= HORIZON_DIAS; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const dow = d.getDay();
    const fecha = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    for (const o of orari) {
      if (DIAS[o.giorno] !== dow) continue;
      if (i === 0 && horaMin(o.ora_inizio) <= nowMinutes + 60) continue; // hoy: nada que empiece en <1h
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
