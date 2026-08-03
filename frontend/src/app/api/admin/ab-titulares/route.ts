import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function isAdmin(): Promise<boolean> {
  const session = (await cookies()).get("admin_session");
  return !!session && session.value === process.env.ADMIN_SESSION_SECRET;
}

const N = 3; // número de titulares del A/B
const ESTADOS_PAGADO = ["pagato", "pagado", "activa", "matricula_pagada"];

const normEmail = (e: string | null | undefined) => (e || "").trim().toLowerCase();
// Solo dígitos, últimos 9 (ignora +34, espacios, ceros de prefijo) para casar teléfonos.
const normPhone = (t: string | null | undefined) => {
  const d = (t || "").replace(/\D/g, "");
  return d.length >= 9 ? d.slice(-9) : "";
};

// A/B de titulares de la landing de adultas. Por cada variante (0,1,2) devuelve:
//  · impresiones → visitas etiquetadas (funnel_eventos)
//  · leads       → formularios enviados (puertas_abiertas_adultas)
//  · ventas      → leads que acabaron siendo inscripción pagada (cruce por
//                  teléfono/email con iscrizioni). Last-touch: si una persona
//                  dejó varios leads, la venta se atribuye al último titular.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  // Impresiones por variante (conteo directo, la tabla de funnel puede ser grande).
  const impresiones: number[] = [];
  for (let v = 0; v < N; v++) {
    const { count } = await supabaseAdmin
      .from("funnel_eventos")
      .select("id", { count: "exact", head: true })
      .eq("funnel", "adultas")
      .eq("step", "pa_visita")
      .eq("variante", v);
    impresiones.push(count ?? 0);
  }

  // Leads (filas del formulario, ordenados para que "el último gane" en el dedupe).
  const { data: leadRows } = await supabaseAdmin
    .from("puertas_abiertas_adultas")
    .select("variante, email, telefono, created_at")
    .order("created_at", { ascending: true });

  const leads = new Array(N).fill(0);
  for (const r of leadRows ?? []) {
    const v = r.variante as number | null;
    if (Number.isInteger(v) && (v as number) >= 0 && (v as number) < N) leads[v as number]++;
  }

  // Inscripciones pagadas (para saber qué leads compraron).
  const { data: paidRows } = await supabaseAdmin
    .from("iscrizioni")
    .select("email, telefono")
    .in("stato", ESTADOS_PAGADO);

  const paidEmails = new Set<string>();
  const paidPhones = new Set<string>();
  for (const p of paidRows ?? []) {
    const e = normEmail(p.email as string | null);
    if (e) paidEmails.add(e);
    const ph = normPhone(p.telefono as string | null);
    if (ph) paidPhones.add(ph);
  }

  // Dedupe de leads por persona (clave = teléfono, que es obligatorio en el form),
  // quedándonos con el último titular que vio (last-touch).
  const personVar = new Map<string, { variante: number; email: string; phone: string }>();
  for (const r of leadRows ?? []) {
    const v = r.variante as number | null;
    if (!(Number.isInteger(v) && (v as number) >= 0 && (v as number) < N)) continue;
    const email = normEmail(r.email as string | null);
    const phone = normPhone(r.telefono as string | null);
    const key = phone || email;
    if (!key) continue;
    personVar.set(key, { variante: v as number, email, phone }); // el último (más reciente) gana
  }

  const ventas = new Array(N).fill(0);
  for (const { variante, email, phone } of personVar.values()) {
    const compro = (phone && paidPhones.has(phone)) || (email && paidEmails.has(email));
    if (compro) ventas[variante]++;
  }

  return NextResponse.json({ impresiones, leads, ventas });
}
