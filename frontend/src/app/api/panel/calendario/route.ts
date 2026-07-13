import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { emailDeSesion } from "@/lib/panel-auth";
import { generarClases } from "@/lib/calendario";
import { getCodigoReferido } from "@/lib/referidos";

type BonoRow = { id: string; disciplina_id: string; nombre: string; creditos_restantes: number; creditos_totales: number; caduca: string; valido_desde: string | null; estado: string };

// Bonos de la alumna + calendario de sus disciplinas, con sus reservas marcadas.
export async function GET() {
  const email = await emailDeSesion();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const hoy = new Date().toISOString().slice(0, 10);

  const { data: bonosData } = await supabaseAdmin
    .from("bonos")
    .select("id, disciplina_id, nombre, creditos_restantes, creditos_totales, caduca, valido_desde, estado")
    .ilike("email", email)
    .order("created_at", { ascending: false });
  const bonos = (bonosData ?? []) as BonoRow[];

  const usables = bonos.filter(b => b.creditos_restantes > 0 && b.caduca >= hoy && (!b.valido_desde || b.valido_desde <= hoy));
  const bonoIds = bonos.map(b => b.id);

  // Reservas de la alumna (con la disciplina de su clase) para mostrarlas SIEMPRE,
  // aunque ya no le queden créditos en ese bono.
  type RCRow = { id: string; orario_id: string; fecha: string; orari: { disciplina_id: string } | { disciplina_id: string }[] | null };
  const reservas: { id: string; orario_id: string; fecha: string; disciplina_id: string }[] = [];
  if (bonoIds.length) {
    const { data: rc } = await supabaseAdmin
      .from("reservas_clase")
      .select("id, orario_id, fecha, orari(disciplina_id)")
      .in("bono_id", bonoIds)
      .gte("fecha", hoy);
    for (const r of (rc ?? []) as RCRow[]) {
      const disc = (Array.isArray(r.orari) ? r.orari[0]?.disciplina_id : r.orari?.disciplina_id) ?? "";
      reservas.push({ id: r.id, orario_id: r.orario_id, fecha: r.fecha, disciplina_id: disc });
    }
  }

  // Disciplinas a mostrar: donde puede reservar (con crédito) + donde ya tiene reserva.
  const disciplinas = [...new Set([
    ...usables.map(b => b.disciplina_id),
    ...reservas.map(r => r.disciplina_id).filter(Boolean),
  ])];
  // Horizonte: hasta la caducidad más lejana con crédito o su reserva más lejana.
  const hasta = [...usables.map(b => b.caduca), ...reservas.map(r => r.fecha)]
    .reduce((m, f) => (f > m ? f : m), "");

  const clases = await generarClases(disciplinas, hasta || undefined);

  // Marca las clases que ya tiene reservadas esta alumna (para poder cancelar).
  if (clases.length) {
    const mine = new Map<string, string>();
    for (const r of reservas) mine.set(`${r.orario_id}|${r.fecha}`, r.id);
    for (const c of clases) c.reserva_id = mine.get(`${c.orario_id}|${c.fecha}`) ?? null;
  }

  // Código de madrina de la alumna (para invitar a amigas). Se crea si no existe.
  let codigo = "";
  try { codigo = await getCodigoReferido(email, bonos[0]?.nombre ?? ""); } catch { /* no bloquea el panel */ }

  return NextResponse.json({ email, codigo, bonos, clases });
}
