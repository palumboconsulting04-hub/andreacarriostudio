import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { emailDeSesion } from "@/lib/panel-auth";
import { generarClases } from "@/lib/calendario";

type BonoRow = { id: string; disciplina_id: string; nombre: string; creditos_restantes: number; creditos_totales: number; caduca: string; estado: string };

// Bonos de la alumna + calendario de sus disciplinas, con sus reservas marcadas.
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

  const disciplinas = [...new Set(bonos.filter(b => b.creditos_restantes > 0 && b.caduca >= hoy).map(b => b.disciplina_id))];
  const bonoIds = bonos.map(b => b.id);

  const clases = await generarClases(disciplinas);

  // Marca las clases que ya tiene reservadas esta alumna (para poder cancelar).
  if (bonoIds.length && clases.length) {
    const { data: rc } = await supabaseAdmin
      .from("reservas_clase").select("id, orario_id, fecha")
      .in("bono_id", bonoIds).gte("fecha", hoy);
    const mine = new Map<string, string>();
    for (const r of (rc ?? []) as { id: string; orario_id: string; fecha: string }[]) mine.set(`${r.orario_id}|${r.fecha}`, r.id);
    for (const c of clases) c.reserva_id = mine.get(`${c.orario_id}|${c.fecha}`) ?? null;
  }

  return NextResponse.json({ email, bonos, clases });
}
