import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Comprueba la cookie de sesión del admin (la misma que valida el middleware).
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

// Lista todas las reservas de Puertas Abiertas. Solo admin.
// Marca cada lead con `ya_inscrita` si su email o teléfono coincide con un
// contacto (alguien que ya pasó por la inscripción), para poder ocultarlos.
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from("puertas_abiertas")
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

  const enriched = (data ?? []).map(r => ({
    ...r,
    ya_inscrita:
      (!!r.email && emails.has(r.email.toLowerCase().trim())) ||
      (!!r.telefono && phones.has(normTel(r.telefono))),
  }));

  return NextResponse.json({ data: enriched });
}

// Actualiza una reserva (etiquetado de origen y/o notas de Andrea). Solo admin.
export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const { id, origen, notas_andrea } = body;
  if (!id) {
    return NextResponse.json({ error: "Falta el id" }, { status: 400 });
  }
  const updates: { origen?: string | null; notas_andrea?: string | null } = {};
  // "" o ausencia → null ("Sin dato"). Cualquier otro valor se guarda tal cual.
  if (origen !== undefined) updates.origen = origen ? String(origen) : null;
  if (notas_andrea !== undefined) updates.notas_andrea = notas_andrea ? String(notas_andrea) : null;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("puertas_abiertas").update(updates).eq("id", id);
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
  const { error } = await supabaseAdmin.from("puertas_abiertas").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
