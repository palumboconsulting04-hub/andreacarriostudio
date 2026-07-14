import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Registra una visita a un enlace de referido (?ref=CODIGO), para medir el funnel
// del programa: cuántos llegan con un link frente a cuántos acaban comprando.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const codigo = (body?.codigo ?? "").toString().trim().toUpperCase().slice(0, 20);
  const session_id = ((body?.session_id ?? "").toString().slice(0, 80)) || null;
  if (!codigo) return NextResponse.json({ ok: false });
  try {
    await supabaseAdmin.from("referido_visitas").insert({ codigo, session_id });
  } catch { /* no bloquea la página */ }
  return NextResponse.json({ ok: true });
}
