import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { emailDeSesion } from "@/lib/panel-auth";

// Buzón de ideas del panel. ANÓNIMO: guardamos solo el texto, nunca quién lo envía.
// Exigimos sesión válida del panel solo como barrera anti-spam (no se almacena).
export async function POST(req: NextRequest) {
  const email = await emailDeSesion();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const texto = (body?.texto ?? "").toString().trim();
  if (!texto) return NextResponse.json({ error: "Escribe tu idea" }, { status: 400 });
  if (texto.length > 2000) return NextResponse.json({ error: "La idea es demasiado larga" }, { status: 400 });

  const { error } = await supabaseAdmin.from("sugerencias").insert({ texto });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
