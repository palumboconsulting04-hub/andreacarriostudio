import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { procesarBonoPagado } from "@/lib/bonos-server";

// Red de seguridad: la thank-you page llama aquí con el session_id para crear el
// bono aunque el webhook no llegue. Es idempotente (no duplica). Devuelve el
// resumen del bono para mostrarlo y facilitar el acceso al panel.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = body?.session_id ? String(body.session_id) : "";
    if (!sessionId) return NextResponse.json({ error: "Falta session_id" }, { status: 400 });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    await procesarBonoPagado(session);

    const { data: bono } = await supabaseAdmin
      .from("bonos")
      .select("nombre, email, disciplina_id, creditos_restantes, caduca")
      .eq("stripe_session_id", session.id)
      .maybeSingle();

    return NextResponse.json({ ok: true, bono: bono ?? null });
  } catch (e) {
    console.error("confirm-bono error:", e);
    return NextResponse.json({ error: "No se pudo confirmar el bono" }, { status: 500 });
  }
}
