import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { slotById } from "@/lib/jornada";

function normTel(t: string | null | undefined): string {
  let d = (t || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 9) d = "34" + d;
  return d;
}

// Match por teléfono: rellena el email en la ficha de Puertas Abiertas si faltaba.
async function enriquecerEmail(telefono: string, email: string) {
  const objetivo = normTel(telefono);
  if (!email || objetivo.length < 11) return;
  for (const tabla of ["puertas_abiertas", "puertas_abiertas_adultas"] as const) {
    const { data } = await supabaseAdmin.from(tabla).select("id, telefono, email");
    for (const r of data ?? []) {
      if (normTel(r.telefono) === objetivo && !(r.email && String(r.email).trim())) {
        await supabaseAdmin.from(tabla).update({ email }).eq("id", r.id);
      }
    }
  }
}

// Apunta a alguien a la lista de espera de una HORA concreta (cuando está llena).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const nombre = (body?.nombre ?? "").toString().trim();
  const telefono = (body?.telefono ?? "").toString().trim();
  const email = (body?.email ?? "").toString().trim();
  const slot_id = (body?.slot_id ?? "").toString();

  const slot = slotById(slot_id);
  if (!nombre || !telefono || !slot) {
    return NextResponse.json({ error: "Faltan datos o el turno no existe." }, { status: 400 });
  }
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    return NextResponse.json({ error: "El email es obligatorio." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("lista_espera_jornada").insert({
    nombre, telefono, email, slot_id,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  try { await enriquecerEmail(telefono, email); } catch { /* ignorar */ }

  return NextResponse.json({ ok: true });
}
