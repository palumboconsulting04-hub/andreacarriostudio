import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Comprueba la cookie de sesión del admin (la misma que valida el middleware).
async function isAdmin(): Promise<boolean> {
  const session = (await cookies()).get("admin_session");
  return !!session && session.value === process.env.ADMIN_SESSION_SECRET;
}

const COLS = "id, categoria, concepto, importe_mensual, importe_anual, notas";

// GET → lista de costes activos.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from("costes")
    .select(COLS)
    .eq("activo", true)
    .order("categoria");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// POST → crea un coste.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => null) as
    | { categoria?: string; concepto?: string; importe_mensual?: number; importe_anual?: number; notas?: string | null }
    | null;
  if (!b?.categoria || !b.concepto) {
    return NextResponse.json({ error: "Faltan categoría y concepto" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("costes")
    .insert({
      categoria: b.categoria,
      concepto: b.concepto,
      importe_mensual: b.importe_mensual ?? 0,
      importe_anual: b.importe_anual ?? 0,
      notas: b.notas || null,
      activo: true,
    })
    .select(COLS)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// PATCH → edita un coste.
export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => null) as
    | { id?: string; concepto?: string; importe_mensual?: number; importe_anual?: number; notas?: string | null }
    | null;
  if (!b?.id) return NextResponse.json({ error: "Falta el id" }, { status: 400 });
  const { error } = await supabaseAdmin
    .from("costes")
    .update({
      concepto: b.concepto,
      importe_mensual: b.importe_mensual,
      importe_anual: b.importe_anual,
      notas: b.notas || null,
    })
    .eq("id", b.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE → baja lógica (activo = false). ?id=
export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta el id" }, { status: 400 });
  const { error } = await supabaseAdmin.from("costes").update({ activo: false }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
