import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function isAdmin(): Promise<boolean> {
  const session = (await cookies()).get("admin_session");
  return !!session && session.value === process.env.ADMIN_SESSION_SECRET;
}

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

// Valores permitidos para los campos de seguimiento.
const ESTADO_CONTACTO = new Set(["sin_llamar", "no_contesta", "interesada", "se_lo_piensa", "no_renueva"]);
const ESTADO_PAGO = new Set(["pendiente", "pagado", "parcial"]);
const METODO_PAGO = new Set(["", "banco", "efectivo", "caja"]);

// Actualiza el seguimiento de una renovación (estado, pago, método, notas). Solo admin.
// Siempre refresca `updated_at` para registrar la última gestión.
export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const { id, estado_contacto, estado_pago, metodo_pago, notas } = body;
  if (!id) {
    return NextResponse.json({ error: "Falta el id" }, { status: 400 });
  }
  const updates: Record<string, string> = { updated_at: new Date().toISOString() };
  if (estado_contacto !== undefined && ESTADO_CONTACTO.has(String(estado_contacto))) updates.estado_contacto = String(estado_contacto);
  if (estado_pago !== undefined && ESTADO_PAGO.has(String(estado_pago))) updates.estado_pago = String(estado_pago);
  if (metodo_pago !== undefined && METODO_PAGO.has(String(metodo_pago))) updates.metodo_pago = String(metodo_pago);
  if (notas !== undefined) updates.notas = String(notas);

  const { error } = await supabaseAdmin.from("renovaciones").update(updates).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
