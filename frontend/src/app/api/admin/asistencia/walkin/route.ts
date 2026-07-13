import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function isAdmin(): Promise<boolean> {
  const session = (await cookies()).get("admin_session");
  return !!session && session.value === process.env.ADMIN_SESSION_SECRET;
}

// GET ?orario_id=  → bonos elegibles para cobrar un walk-in en esa clase
// (con crédito, de esa disciplina, no caducados).
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const orarioId = req.nextUrl.searchParams.get("orario_id");
  if (!orarioId) return NextResponse.json({ error: "Falta orario_id" }, { status: 400 });

  const hoy = new Date().toISOString().slice(0, 10);
  const { data: orario } = await supabaseAdmin.from("orari").select("disciplina_id").eq("id", orarioId).single();
  if (!orario) return NextResponse.json({ error: "Clase no encontrada" }, { status: 404 });

  const { data, error } = await supabaseAdmin
    .from("bonos")
    .select("id, nombre, email, creditos_restantes")
    .eq("disciplina_id", orario.disciplina_id)
    .gt("creditos_restantes", 0)
    .gte("caduca", hoy)
    .order("nombre");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ bonos: data ?? [] });
}

// POST { bono_id, orario_id, fecha } → cobra 1 crédito, crea la reserva y marca presente.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json().catch(() => null) as { bono_id?: string; orario_id?: string; fecha?: string } | null;
  if (!body?.bono_id || !body.orario_id || !body.fecha) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin.rpc("admin_cobrar_walkin", {
    p_bono: body.bono_id, p_orario: body.orario_id, p_fecha: body.fecha,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const res = data as { ok: boolean; error?: string; reserva_id?: string };
  if (!res.ok) return NextResponse.json({ error: res.error ?? "No se pudo cobrar la clase" }, { status: 400 });

  // Marcar presente a la que acaba de entrar.
  if (res.reserva_id) {
    await supabaseAdmin.from("asistencia").upsert(
      { reserva_id: res.reserva_id, orario_id: body.orario_id, fecha: body.fecha, estado: "presente" },
      { onConflict: "reserva_id" },
    );
  }
  return NextResponse.json({ ok: true });
}
