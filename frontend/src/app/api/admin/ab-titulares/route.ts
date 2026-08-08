import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function isAdmin(): Promise<boolean> {
  const session = (await cookies()).get("admin_session");
  return !!session && session.value === process.env.ADMIN_SESSION_SECRET;
}

const N = 3; // variantes (0,1,2)
const ESTADOS_PAGADO = ["pagato", "pagado", "activa", "matricula_pagada"];

// Corte: momento en que la landing pasó del A/B de titulares (rotación al azar)
// al TITULAR POR DISCIPLINA (message match). Antes de esta fecha, variante 0/1/2
// = titulares (peques/tonificar/chiringuito); desde ella, 0/1/2 = disciplina
// (directo/barre/pilates). Se separa por fecha para no mezclar ni perder lo viejo.
const CORTE = "2026-08-07T20:20:00Z";

const normEmail = (e: string | null | undefined) => (e || "").trim().toLowerCase();
// Solo dígitos, últimos 9 (ignora +34, espacios) para casar teléfonos.
const normPhone = (t: string | null | undefined) => {
  const d = (t || "").replace(/\D/g, "");
  return d.length >= 9 ? d.slice(-9) : "";
};

type Bloque = { impresiones: number[]; leads: number[]; ventas: number[] };

// Calcula impresiones/leads/ventas por variante en una ventana de fechas
// [desde, hasta). null = sin límite por ese lado.
async function calcular(desde: string | null, hasta: string | null, paidEmails: Set<string>, paidPhones: Set<string>): Promise<Bloque> {
  const impresiones: number[] = [];
  for (let v = 0; v < N; v++) {
    let q = supabaseAdmin
      .from("funnel_eventos")
      .select("id", { count: "exact", head: true })
      .eq("funnel", "adultas")
      .eq("step", "pa_visita")
      .eq("variante", v);
    if (desde) q = q.gte("created_at", desde);
    if (hasta) q = q.lt("created_at", hasta);
    const { count } = await q;
    impresiones.push(count ?? 0);
  }

  let lq = supabaseAdmin
    .from("puertas_abiertas_adultas")
    .select("variante, email, telefono, created_at")
    .order("created_at", { ascending: true });
  if (desde) lq = lq.gte("created_at", desde);
  if (hasta) lq = lq.lt("created_at", hasta);
  const { data: leadRows } = await lq;

  const leads = new Array(N).fill(0);
  // Dedupe por persona (teléfono/email); el último titular visto gana (last-touch).
  const personVar = new Map<string, { variante: number; email: string; phone: string }>();
  for (const r of leadRows ?? []) {
    const v = r.variante as number | null;
    if (!(Number.isInteger(v) && (v as number) >= 0 && (v as number) < N)) continue;
    leads[v as number]++;
    const email = normEmail(r.email as string | null);
    const phone = normPhone(r.telefono as string | null);
    const key = phone || email;
    if (!key) continue;
    personVar.set(key, { variante: v as number, email, phone });
  }

  const ventas = new Array(N).fill(0);
  for (const { variante, email, phone } of personVar.values()) {
    if ((phone && paidPhones.has(phone)) || (email && paidEmails.has(email))) ventas[variante]++;
  }
  return { impresiones, leads, ventas };
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: paidRows } = await supabaseAdmin.from("iscrizioni").select("email, telefono").in("stato", ESTADOS_PAGADO);
  const paidEmails = new Set<string>();
  const paidPhones = new Set<string>();
  for (const p of paidRows ?? []) {
    const e = normEmail(p.email as string | null);
    if (e) paidEmails.add(e);
    const ph = normPhone(p.telefono as string | null);
    if (ph) paidPhones.add(ph);
  }

  const historico = await calcular(null, CORTE, paidEmails, paidPhones);
  const disciplina = await calcular(CORTE, null, paidEmails, paidPhones);
  return NextResponse.json({ historico, disciplina, corte: CORTE });
}
