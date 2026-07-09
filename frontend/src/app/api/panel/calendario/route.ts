import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { emailDeSesion } from "@/lib/panel-auth";

const DIAS: Record<string, number> = {
  "Domingo": 0, "Lunes": 1, "Martes": 2, "Miércoles": 3, "Miercoles": 3,
  "Jueves": 4, "Viernes": 5, "Sábado": 6, "Sabado": 6,
};
const HORIZON_DIAS = 28;
const pad = (n: number) => String(n).padStart(2, "0");
const horaMin = (t: string) => { const [h, m] = t.split(":"); return (+h) * 60 + (+m); };

type OrarioRow = { id: string; disciplina_id: string; giorno: string; ora_inizio: string; ora_fine: string; posti_totali: number };
type BonoRow = { id: string; disciplina_id: string; nombre: string; creditos_restantes: number; creditos_totales: number; caduca: string; estado: string };

// Devuelve los bonos de la alumna + el calendario de clases (con fecha) de sus
// disciplinas, con plazas libres reales y marca de las que ya tiene reservadas.
export async function GET() {
  const email = await emailDeSesion();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const hoy = new Date().toISOString().slice(0, 10);

  const { data: bonosData } = await supabaseAdmin
    .from("bonos")
    .select("id, disciplina_id, nombre, creditos_restantes, creditos_totales, caduca, estado")
    .ilike("email", email)
    .order("created_at", { ascending: false });
  const bonos = (bonosData ?? []) as BonoRow[];

  // Disciplinas con bono utilizable (créditos > 0 y no caducado).
  const disciplinas = [...new Set(bonos.filter(b => b.creditos_restantes > 0 && b.caduca >= hoy).map(b => b.disciplina_id))];
  const bonoIds = bonos.map(b => b.id);

  if (disciplinas.length === 0) {
    return NextResponse.json({ email, bonos, clases: [] });
  }

  const { data: orariData } = await supabaseAdmin
    .from("orari")
    .select("id, disciplina_id, giorno, ora_inizio, ora_fine, posti_totali")
    .in("disciplina_id", disciplinas)
    .eq("attivo", true);
  const orari = (orariData ?? []) as OrarioRow[];
  const orarioById = new Map(orari.map(o => [o.id, o]));
  const orarioIds = orari.map(o => o.id);

  // Ocupación fija (mensualidades) por horario.
  const mensuales: Record<string, number> = {};
  if (orarioIds.length) {
    const { data: io } = await supabaseAdmin.from("iscrizione_orari").select("orario_id").in("orario_id", orarioIds);
    for (const r of (io ?? []) as { orario_id: string }[]) mensuales[r.orario_id] = (mensuales[r.orario_id] ?? 0) + 1;
  }

  // Reservas de bono (de todas las alumnas) desde hoy → ocupación por (horario, fecha).
  // Y las reservas de ESTA alumna → para marcarlas y permitir cancelar.
  const bonoCount: Record<string, number> = {};
  const misReservas: Record<string, string> = {}; // clave orario|fecha → reserva_id
  if (orarioIds.length) {
    const { data: rc } = await supabaseAdmin
      .from("reservas_clase").select("id, orario_id, fecha, bono_id")
      .in("orario_id", orarioIds).gte("fecha", hoy);
    const misBonos = new Set(bonoIds);
    for (const r of (rc ?? []) as { id: string; orario_id: string; fecha: string; bono_id: string }[]) {
      const k = `${r.orario_id}|${r.fecha}`;
      bonoCount[k] = (bonoCount[k] ?? 0) + 1;
      if (misBonos.has(r.bono_id)) misReservas[k] = r.id;
    }
  }

  // Genera las instancias (clases con fecha) del horizonte, en hora de Madrid.
  const nowMadrid = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
  const nowMinutes = nowMadrid.getHours() * 60 + nowMadrid.getMinutes();
  const start = new Date(nowMadrid); start.setHours(0, 0, 0, 0);

  const clases: {
    orario_id: string; disciplina_id: string; fecha: string; dia: string;
    hora: string; horaFin: string; libres: number; tope: number; reserva_id: string | null;
  }[] = [];

  for (let i = 0; i <= HORIZON_DIAS; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const dow = d.getDay();
    const fecha = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    for (const o of orari) {
      if (DIAS[o.giorno] !== dow) continue;
      // Hoy: no ofrecer clases que empiezan en menos de 1 h.
      if (i === 0 && horaMin(o.ora_inizio) <= nowMinutes + 60) continue;
      const k = `${o.id}|${fecha}`;
      const ocupadas = (mensuales[o.id] ?? 0) + (bonoCount[k] ?? 0);
      clases.push({
        orario_id: o.id,
        disciplina_id: o.disciplina_id,
        fecha,
        dia: o.giorno,
        hora: o.ora_inizio.slice(0, 5),
        horaFin: o.ora_fine.slice(0, 5),
        libres: Math.max(0, o.posti_totali - ocupadas),
        tope: o.posti_totali,
        reserva_id: misReservas[k] ?? null,
      });
    }
  }

  clases.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  void orarioById; // (referencia disponible si se necesita)
  return NextResponse.json({ email, bonos, clases });
}
