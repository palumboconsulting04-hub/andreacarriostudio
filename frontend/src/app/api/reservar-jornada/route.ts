import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { SLOTS, slotById } from "@/lib/jornada";

// Normaliza un teléfono a solo dígitos en formato español, para comparar.
function normTel(t: string | null | undefined): string {
  let d = (t || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 9) d = "34" + d;
  return d;
}

// Match por teléfono: si esta persona ya está en Puertas Abiertas (niñas o adultas)
// y NO tenía email (no se lo pedimos entonces), le rellenamos el correo ahora.
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

// Plazas ocupadas por turno (sin datos personales). Para pintar la disponibilidad.
export async function GET() {
  const { data, error } = await supabaseAdmin.from("reservas_jornada").select("slot_id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ocupadas: Record<string, number> = {};
  for (const r of data ?? []) ocupadas[r.slot_id] = (ocupadas[r.slot_id] ?? 0) + 1;
  // Devuelve, por turno, plazas ocupadas y libres.
  const slots = SLOTS.map(s => {
    const usadas = ocupadas[s.id] ?? 0;
    return { id: s.id, ocupadas: usadas, libres: Math.max(0, s.tope - usadas) };
  });
  return NextResponse.json({ slots });
}

// Reserva una plaza en un turno. Comprueba el tope (server-side) antes de guardar.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const nombre = (body?.nombre ?? "").toString().trim();
  const telefono = (body?.telefono ?? "").toString().trim();
  const email = (body?.email ?? "").toString().trim();
  const slot_id = (body?.slot_id ?? "").toString();
  const nombre_madre = (body?.nombre_madre ?? "").toString().trim();

  const slot = slotById(slot_id);
  if (!nombre || !telefono || !slot) {
    return NextResponse.json({ error: "Faltan datos o el turno no existe." }, { status: 400 });
  }
  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    return NextResponse.json({ error: "El email es obligatorio." }, { status: 400 });
  }
  // En turnos de niñas, "nombre" es la niña y hace falta también el de la madre/padre.
  if (slot.bloque === "ninas" && !nombre_madre) {
    return NextResponse.json({ error: "Falta el nombre de la madre o el padre." }, { status: 400 });
  }

  // Control de tope: no dejar reservar por encima de la capacidad del turno.
  const { count, error: countErr } = await supabaseAdmin
    .from("reservas_jornada")
    .select("id", { count: "exact", head: true })
    .eq("slot_id", slot_id);
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });
  if ((count ?? 0) >= slot.tope) {
    return NextResponse.json({ error: "COMPLETO", message: "Ese turno se ha llenado. Elige otro, por favor." }, { status: 409 });
  }

  const { error } = await supabaseAdmin.from("reservas_jornada").insert({
    nombre, telefono, email: email || null, slot_id, bloque: slot.bloque,
    nombre_madre: nombre_madre || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Cruce por teléfono: rellena el email en su ficha de Puertas Abiertas si faltaba.
  // No bloquea la reserva si algo falla.
  if (email) { try { await enriquecerEmail(telefono, email); } catch { /* ignorar */ } }

  return NextResponse.json({ ok: true });
}
