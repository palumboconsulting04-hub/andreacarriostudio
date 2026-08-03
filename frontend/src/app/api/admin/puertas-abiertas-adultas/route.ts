import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function isAdmin(): Promise<boolean> {
  const session = (await cookies()).get("admin_session");
  return !!session && session.value === process.env.ADMIN_SESSION_SECRET;
}

// Normaliza un teléfono a solo dígitos en formato español para poder comparar.
function normTel(t: string | null | undefined): string {
  let d = (t || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 9) d = "34" + d;
  return d;
}

// Lista las reservas de Puertas Abiertas Adultas. Solo admin.
// Marca cada lead con `ya_inscrita` si su email o teléfono ya está en contatti.
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from("puertas_abiertas_adultas")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: contatti } = await supabaseAdmin.from("contatti").select("email, telefono");
  const emails = new Set(
    (contatti ?? []).map(c => (c.email || "").toLowerCase().trim()).filter(Boolean),
  );
  const phones = new Set(
    (contatti ?? []).map(c => normTel(c.telefono)).filter(Boolean),
  );

  // Fase del embudo (dónde quedó cada lead): se cruza con iscrizioni.
  //  · solo_datos      → no hay inscripción: dejó datos en la landing pero no
  //                      llegó a darle a pagar en el checkout.
  //  · pago_incompleto → inscripción en attesa/impago: empezó el pago, no acabó.
  //  · compro          → inscripción pagada: es clienta.
  const { data: iscr } = await supabaseAdmin.from("iscrizioni").select("email, telefono, stato");
  const PAID = new Set(["pagato", "pagado", "activa", "matricula_pagada"]);
  const paidEmails = new Set<string>();
  const paidPhones = new Set<string>();
  const openEmails = new Set<string>();
  const openPhones = new Set<string>();
  for (const it of iscr ?? []) {
    const e = (it.email || "").toLowerCase().trim();
    const p = normTel(it.telefono);
    if (PAID.has(it.stato)) {
      if (e) paidEmails.add(e);
      if (p) paidPhones.add(p);
    } else {
      if (e) openEmails.add(e);
      if (p) openPhones.add(p);
    }
  }
  const faseDe = (r: { email?: string | null; telefono?: string | null }): string => {
    const e = (r.email || "").toLowerCase().trim();
    const p = normTel(r.telefono);
    if ((e && paidEmails.has(e)) || (p && paidPhones.has(p))) return "compro";
    if ((e && openEmails.has(e)) || (p && openPhones.has(p))) return "pago_incompleto";
    return "solo_datos";
  };

  const enriched = (data ?? []).map(r => ({
    ...r,
    ya_inscrita:
      (!!r.email && emails.has(r.email.toLowerCase().trim())) ||
      (!!r.telefono && phones.has(normTel(r.telefono))),
    fase: faseDe(r),
  }));

  return NextResponse.json({ data: enriched });
}

const LLAMADA_VALIDA = new Set(["sin_llamar", "realizada", "no_contesta", "no_disponible"]);
const CONFIRMACION_VALIDA = new Set(["pendiente", "confirma", "no_viene"]);

// Actualiza una reserva (origen, notas, llamada, confirmación). Solo admin.
export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const { id, origen, notas_andrea, llamada, confirmacion } = body;
  if (!id) {
    return NextResponse.json({ error: "Falta el id" }, { status: 400 });
  }
  const updates: { origen?: string | null; notas_andrea?: string | null; llamada?: string; confirmacion?: string } = {};
  if (origen !== undefined) updates.origen = origen ? String(origen) : null;
  if (notas_andrea !== undefined) updates.notas_andrea = notas_andrea ? String(notas_andrea) : null;
  if (llamada !== undefined && LLAMADA_VALIDA.has(String(llamada))) updates.llamada = String(llamada);
  if (confirmacion !== undefined && CONFIRMACION_VALIDA.has(String(confirmacion))) updates.confirmacion = String(confirmacion);
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("puertas_abiertas_adultas").update(updates).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// Borra una reserva por id. Solo admin.
export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Falta el id" }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("puertas_abiertas_adultas").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
