import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Comprueba la cookie de sesión del admin (la misma que valida el middleware).
async function isAdmin(): Promise<boolean> {
  const session = (await cookies()).get("admin_session");
  return !!session && session.value === process.env.ADMIN_SESSION_SECRET;
}

// Columnas completas que necesita el admin (superset de todas las pantallas).
const COLS =
  "id, nome, cognome, nome_alumna, cognome_alumna, email, telefono, stato, created_at, disciplina_id, piano_id, metodo_pagamento, matricula, matricula_pagada, prezzo, stripe_subscription_id, stripe_customer_id, discipline(nome), iscrizione_orari(orario_id, orari(giorno, ora_inizio, ora_fine))";

// GET → lista de inscripciones con service-role (solo admin).
//  · ?id=        → una inscripción concreta
//  · ?stato=     → filtra por estado exacto
//  · ?inscritas  → solo estados con plaza (pagato/pagado/activa/matricula_pagada)
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const id = sp.get("id");

  if (id) {
    const { data, error } = await supabaseAdmin.from("iscrizioni").select(COLS).eq("id", id).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  }

  // Alumnas inscritas a una clase concreta (para el drawer de clase del Calendario).
  const orarioId = sp.get("orario_id");
  if (orarioId) {
    const { data, error } = await supabaseAdmin
      .from("iscrizione_orari")
      .select("iscrizione_id, iscrizioni(id, nome, cognome, nome_alumna, cognome_alumna, disciplina_id, stato, email, telefono)")
      .eq("orario_id", orarioId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data: data ?? [] });
  }

  let q = supabaseAdmin.from("iscrizioni").select(COLS).order("created_at", { ascending: false });
  const stato = sp.get("stato");
  if (stato) q = q.eq("stato", stato);
  if (sp.has("inscritas")) q = q.in("stato", ["pagato", "pagado", "activa", "matricula_pagada"]);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// PATCH → editar el contacto (email / teléfono) de una inscripción. Solo admin.
export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const id = body?.id;
  if (!id) return NextResponse.json({ error: "Falta el id" }, { status: 400 });

  const patch: { email?: string; telefono?: string | null; stato?: string; piano_id?: string; matricula?: number; metodo_pagamento?: string; prezzo?: number | null } = {};
  if (typeof body.email === "string") {
    const email = body.email.trim().toLowerCase();
    if (!/\S+@\S+\.\S+/.test(email)) return NextResponse.json({ error: "Correo no válido" }, { status: 400 });
    patch.email = email;
  }
  if ("telefono" in body) {
    const tel = typeof body.telefono === "string" ? body.telefono.trim() : "";
    patch.telefono = tel || null;
  }
  // Edición directa desde el admin (estado, plan, matrícula, método de pago).
  const ESTADOS = ["attesa", "pagato", "pagado", "activa", "matricula_pagada", "impago", "cancelada"];
  if (typeof body.stato === "string") {
    if (!ESTADOS.includes(body.stato)) return NextResponse.json({ error: "Estado no válido" }, { status: 400 });
    patch.stato = body.stato;
  }
  if (typeof body.piano_id === "string" && body.piano_id) patch.piano_id = body.piano_id;
  if (body.matricula !== undefined && body.matricula !== null && !Number.isNaN(Number(body.matricula))) patch.matricula = Number(body.matricula);
  if (typeof body.metodo_pagamento === "string" && body.metodo_pagamento) patch.metodo_pagamento = body.metodo_pagamento;
  // Cuota personalizada (prezzo). null/"" = usar el precio del plan.
  if ("prezzo" in body) patch.prezzo = (body.prezzo === null || body.prezzo === "" || Number.isNaN(Number(body.prezzo))) ? null : Number(body.prezzo);
  const horariosProvided = Array.isArray(body.horarios);
  if (Object.keys(patch).length === 0 && !horariosProvided) return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });

  // Campos de la inscripción (estado, plan, matrícula, método, cuota).
  let data: unknown = null;
  if (Object.keys(patch).length > 0) {
    const { data: d, error } = await supabaseAdmin.from("iscrizioni").update(patch).eq("id", id).select("id, email, telefono, stato, piano_id, matricula, metodo_pagamento, prezzo").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    data = d;
  }

  // Horarios: reemplaza las asignaciones de iscrizione_orari por las nuevas (si se envían).
  if (horariosProvided) {
    const horarios = (body.horarios as unknown[]).filter((h): h is string => typeof h === "string");
    const { error: delErr } = await supabaseAdmin.from("iscrizione_orari").delete().eq("iscrizione_id", id);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
    if (horarios.length > 0) {
      const { error: insErr } = await supabaseAdmin.from("iscrizione_orari").insert(horarios.map((orario_id) => ({ iscrizione_id: id, orario_id })));
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
  }

  return NextResponse.json({ data });
}
