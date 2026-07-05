import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function isAdmin(): Promise<boolean> {
  const session = (await cookies()).get("admin_session");
  return !!session && session.value === process.env.ADMIN_SESSION_SECRET;
}

// Lista las reservas + la lista de espera de la Jornada. Solo admin.
export async function GET() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const [reservas, espera] = await Promise.all([
    supabaseAdmin.from("reservas_jornada").select("*").order("created_at", { ascending: true }),
    supabaseAdmin.from("lista_espera_jornada").select("*").order("created_at", { ascending: true }),
  ]);
  if (reservas.error) return NextResponse.json({ error: reservas.error.message }, { status: 500 });
  return NextResponse.json({ data: reservas.data, espera: espera.data ?? [] });
}

// Marca asistencia (vino / no vino / sin marcar) o guarda notas. Solo admin.
export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const body = await req.json();
  const { id, asistio, notas, tipo, avisado } = body;
  if (!id) return NextResponse.json({ error: "Falta el id" }, { status: 400 });
  // Lista de espera: solo se marca "avisado".
  if (tipo === "espera") {
    const { error } = await supabaseAdmin.from("lista_espera_jornada").update({ avisado: !!avisado }).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  const updates: { asistio?: boolean | null; notas?: string | null } = {};
  if (asistio !== undefined) updates.asistio = asistio === null ? null : !!asistio;
  if (notas !== undefined) updates.notas = notas ? String(notas) : null;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  }
  const { error } = await supabaseAdmin.from("reservas_jornada").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// Borra una reserva por id. Solo admin.
export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta el id" }, { status: 400 });
  const { error } = await supabaseAdmin.from("reservas_jornada").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
