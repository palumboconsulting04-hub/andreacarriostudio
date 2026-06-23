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

// Valores permitidos para los seguimientos manuales.
const LLAMADA_VALIDA = new Set(["sin_llamar", "realizada", "no_contesta", "no_disponible"]);
const CONFIRMACION_VALIDA = new Set(["pendiente", "confirma", "no_viene"]);

// Etiquetas de grupo válidas (las mismas que el formulario público).
const GRUPOS_VALIDOS = new Set([
  "Pre-Ballet · 3–6 años",
  "Ballet 1 · 7–9 años",
  "Ballet 2 · 10–14 años",
]);

// Alta manual de una reserva (Andrea apunta a mano una niña que se ha
// inscrito por otra vía: en persona, por teléfono, etc.). Solo admin.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const nombre = String(body?.nombre ?? "").trim();
  const telefono = String(body?.telefono ?? "").trim();
  const ninasRaw = Array.isArray(body?.ninas) ? body.ninas : [];
  const ninas = ninasRaw
    .map((n: { nombre?: string; edad?: string }) => ({
      nombre: String(n?.nombre ?? "").trim(),
      edad: String(n?.edad ?? "").trim(),
    }))
    .filter((n: { nombre: string; edad: string }) => n.nombre && GRUPOS_VALIDOS.has(n.edad));

  if (!nombre || !telefono || ninas.length === 0) {
    return NextResponse.json(
      { error: "Faltan datos: contacto, teléfono y al menos una niña con grupo válido." },
      { status: 400 },
    );
  }

  const confirmacion = CONFIRMACION_VALIDA.has(String(body?.confirmacion))
    ? String(body.confirmacion)
    : "confirma";

  const { data, error } = await supabaseAdmin
    .from("puertas_abiertas")
    .insert({
      nombre,
      apellido: String(body?.apellido ?? "").trim(),
      email: String(body?.email ?? "").trim(),
      telefono,
      ninas,
      origen: "manual",
      confirmacion,
    })
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data: { ...data, ya_inscrita: false } });
}

// Actualiza una reserva (origen, notas, estado de llamada y confirmación). Solo admin.
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
  // "" o ausencia → null ("Sin dato"). Cualquier otro valor se guarda tal cual.
  if (origen !== undefined) updates.origen = origen ? String(origen) : null;
  if (notas_andrea !== undefined) updates.notas_andrea = notas_andrea ? String(notas_andrea) : null;
  if (llamada !== undefined && LLAMADA_VALIDA.has(String(llamada))) updates.llamada = String(llamada);
  if (confirmacion !== undefined && CONFIRMACION_VALIDA.has(String(confirmacion))) updates.confirmacion = String(confirmacion);
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
