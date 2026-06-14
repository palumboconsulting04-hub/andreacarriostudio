import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function isAdmin(): Promise<boolean> {
  const session = (await cookies()).get("admin_session");
  return !!session && session.value === process.env.ADMIN_SESSION_SECRET;
}

const GRUPOS = new Set(["Pre-Ballet", "Ballet 1", "Ballet 2"]);
const ESTADO_CONTACTO = new Set(["sin_llamar", "no_contesta", "interesada", "se_lo_piensa", "no_renueva"]);
const ESTADO_PAGO = new Set(["pendiente", "pagado", "parcial"]);
const METODO_PAGO = new Set(["", "efectivo", "bizum", "web"]);

// Lista las renovaciones del curso 2026-2027. Solo admin.
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const { data, error } = await supabaseAdmin
    .from("renovaciones")
    .select("*")
    .order("grupo", { ascending: true })
    .order("apellidos", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

// Crea una alumna manualmente (por si Andrea se olvidó de alguna). Solo admin.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const b = await req.json();
  if (!b?.nombre || !String(b.nombre).trim()) {
    return NextResponse.json({ error: "Falta el nombre" }, { status: 400 });
  }
  const grupo = GRUPOS.has(b.grupo) ? b.grupo : "Pre-Ballet";
  const row = {
    nombre: String(b.nombre).trim(),
    apellidos: b.apellidos ? String(b.apellidos).trim() : "",
    fecha_nacimiento: b.fecha_nacimiento || null,
    grupo,
    telefono: b.telefono ? String(b.telefono).trim() : null,
    email: b.email ? String(b.email).trim() : null,
    nota: b.nota ? String(b.nota).trim() : null,
  };
  const { data, error } = await supabaseAdmin.from("renovaciones").insert(row).select().single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

// Actualiza una renovación: campos fijos (nombre, datos…) y/o seguimiento. Solo admin.
// Siempre refresca `updated_at`.
export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const { id } = body;
  if (!id) {
    return NextResponse.json({ error: "Falta el id" }, { status: 400 });
  }
  const updates: Record<string, string | null> = { updated_at: new Date().toISOString() };

  // Campos fijos editables.
  if (body.nombre !== undefined) updates.nombre = String(body.nombre).trim();
  if (body.apellidos !== undefined) updates.apellidos = String(body.apellidos).trim();
  if (body.fecha_nacimiento !== undefined) updates.fecha_nacimiento = body.fecha_nacimiento || null;
  if (body.grupo !== undefined && GRUPOS.has(body.grupo)) updates.grupo = String(body.grupo);
  if (body.telefono !== undefined) updates.telefono = body.telefono ? String(body.telefono).trim() : null;
  if (body.email !== undefined) updates.email = body.email ? String(body.email).trim() : null;
  if (body.nota !== undefined) updates.nota = body.nota ? String(body.nota).trim() : null;
  // Seguimiento.
  if (body.estado_contacto !== undefined && ESTADO_CONTACTO.has(String(body.estado_contacto))) updates.estado_contacto = String(body.estado_contacto);
  if (body.estado_pago !== undefined && ESTADO_PAGO.has(String(body.estado_pago))) updates.estado_pago = String(body.estado_pago);
  if (body.metodo_pago !== undefined && METODO_PAGO.has(String(body.metodo_pago))) updates.metodo_pago = String(body.metodo_pago);
  if (body.notas !== undefined) updates.notas = String(body.notas);

  const { error } = await supabaseAdmin.from("renovaciones").update(updates).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// Borra una alumna por id. Solo admin.
export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Falta el id" }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("renovaciones").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
