import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { emailDeSesion } from "@/lib/panel-auth";

// Cancela una reserva de la alumna (devuelve el crédito si faltan >4 h).
export async function POST(req: NextRequest) {
  const email = await emailDeSesion();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const reserva_id = (body?.reserva_id ?? "").toString();
  if (!reserva_id) return NextResponse.json({ error: "Falta la reserva" }, { status: 400 });

  const { data: r } = await supabaseAdmin.from("reservas_clase").select("id, bono_id").eq("id", reserva_id).maybeSingle();
  if (!r) return NextResponse.json({ error: "Reserva no encontrada" }, { status: 404 });

  // La reserva tiene que ser de un bono de esta alumna.
  const { data: bono } = await supabaseAdmin.from("bonos").select("id").eq("id", r.bono_id).ilike("email", email).maybeSingle();
  if (!bono) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { data, error } = await supabaseAdmin.rpc("cancelar_reserva", { p_reserva: reserva_id, p_bono: r.bono_id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const res = data as { ok: boolean; error?: string };
  if (!res?.ok) return NextResponse.json({ error: res?.error || "No se pudo cancelar" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
