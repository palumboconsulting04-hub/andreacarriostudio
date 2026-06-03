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
  "id, nome, cognome, nome_alumna, cognome_alumna, email, telefono, stato, created_at, disciplina_id, piano_id, metodo_pagamento, matricula, stripe_subscription_id, stripe_customer_id, discipline(nome), iscrizione_orari(orari(giorno, ora_inizio, ora_fine))";

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
      .select("iscrizione_id, iscrizioni(id, nome, cognome, nome_alumna, cognome_alumna, disciplina_id, stato)")
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
