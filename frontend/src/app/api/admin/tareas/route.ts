import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Comprueba la cookie de sesión del admin (la misma que valida el middleware).
async function isAdmin(): Promise<boolean> {
  const session = (await cookies()).get("admin_session");
  return !!session && session.value === process.env.ADMIN_SESSION_SECRET;
}

const RESPONSABLE = new Set(["mia", "andrea"]);
const ESTADO = new Set(["pendiente", "en_curso", "hecha"]);

// GET → lista de tareas. Solo admin.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from("tareas")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// POST → crea una tarea. Solo admin.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const texto = String(body?.texto ?? "").trim();
  if (!texto) return NextResponse.json({ error: "Falta el texto de la tarea" }, { status: 400 });
  const responsable = RESPONSABLE.has(String(body?.responsable)) ? String(body.responsable) : "mia";
  const { data, error } = await supabaseAdmin
    .from("tareas")
    .insert({ texto, responsable })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

// PATCH → edita una tarea (texto, responsable, estado, notas). Solo admin.
export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const id = body?.id;
  if (!id) return NextResponse.json({ error: "Falta el id" }, { status: 400 });

  const updates: Record<string, string | null> = { updated_at: new Date().toISOString() };
  if (body.texto !== undefined) {
    const t = String(body.texto).trim();
    if (!t) return NextResponse.json({ error: "El texto no puede quedar vacío" }, { status: 400 });
    updates.texto = t;
  }
  if (body.responsable !== undefined && RESPONSABLE.has(String(body.responsable))) updates.responsable = String(body.responsable);
  if (body.estado !== undefined && ESTADO.has(String(body.estado))) updates.estado = String(body.estado);
  if (body.notas !== undefined) updates.notas = body.notas ? String(body.notas) : null;

  const { error } = await supabaseAdmin.from("tareas").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE → borra una tarea por id. Solo admin.
export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta el id" }, { status: 400 });
  const { error } = await supabaseAdmin.from("tareas").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
