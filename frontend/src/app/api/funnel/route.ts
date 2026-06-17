import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Registra (anónimamente) que una sesión ha llegado a un paso del funnel de
// inscripción, para poder ver el embudo en el admin. No guarda datos personales:
// solo un id de sesión aleatorio del navegador y el nombre del paso.
const STEPS = new Set([
  "paso1_disciplina",
  "paso2_plan",
  "paso3_horarios",
  "paso4_crosssell",
  "paso5_pago",
  "compra",
]);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const session_id = (body?.session_id ?? "").toString().slice(0, 64);
  const step = (body?.step ?? "").toString();
  const origen = body?.origen === "ads" ? "ads" : "directo";
  if (!session_id || !STEPS.has(step)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  // Inserta vía service-role (la tabla está cerrada a la clave pública).
  await supabaseAdmin.from("funnel_eventos").insert({ session_id, step, origen });
  return NextResponse.json({ ok: true });
}
