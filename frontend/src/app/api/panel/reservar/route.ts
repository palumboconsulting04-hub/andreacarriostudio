import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { emailDeSesion } from "@/lib/panel-auth";

// Reserva una clase con un bono de la alumna (comprobación atómica en la base).
export async function POST(req: NextRequest) {
  const email = await emailDeSesion();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const bono_id = (body?.bono_id ?? "").toString();
  const orario_id = (body?.orario_id ?? "").toString();
  const fecha = (body?.fecha ?? "").toString();
  if (!bono_id || !orario_id || !fecha) return NextResponse.json({ error: "Faltan datos" }, { status: 400 });

  // El bono tiene que ser de esta alumna.
  const { data: bono } = await supabaseAdmin.from("bonos").select("id").eq("id", bono_id).ilike("email", email).maybeSingle();
  if (!bono) return NextResponse.json({ error: "Bono no válido" }, { status: 403 });

  const { data, error } = await supabaseAdmin.rpc("reservar_clase", { p_bono: bono_id, p_orario: orario_id, p_fecha: fecha });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const res = data as { ok: boolean; error?: string };
  if (!res?.ok) return NextResponse.json({ error: res?.error || "No se pudo reservar" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
