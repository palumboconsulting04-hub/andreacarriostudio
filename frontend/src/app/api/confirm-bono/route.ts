import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { procesarBonoPagado } from "@/lib/bonos-server";

// Red de seguridad: la thank-you page llama aquí con el session_id para crear el
// bono aunque el webhook no llegue. Es idempotente (no duplica).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const sessionId = body?.session_id ? String(body.session_id) : "";
    if (!sessionId) return NextResponse.json({ error: "Falta session_id" }, { status: 400 });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    await procesarBonoPagado(session);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("confirm-bono error:", e);
    return NextResponse.json({ error: "No se pudo confirmar el bono" }, { status: 500 });
  }
}
