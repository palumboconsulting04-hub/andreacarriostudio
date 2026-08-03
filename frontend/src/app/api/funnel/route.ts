import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Registra (anónimamente) que una sesión ha llegado a un paso del funnel de
// inscripción, para poder ver el embudo en el admin. No guarda datos personales:
// solo un id de sesión aleatorio del navegador y el nombre del paso.
const STEPS = new Set([
  // Funnel de inscripción
  "paso1_disciplina",
  "paso2_plan",
  "paso3_horarios",
  "paso4_crosssell",
  "paso5_pago",
  "compra",
  // Funnel de Puertas Abiertas
  "pa_visita",
  "pa_click",
  "pa_reserva",
  // Funnel de la landing "Reservar jornada"
  "jor_visita",
  "jor_slot",
  "jor_reserva",
]);

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const session_id = (body?.session_id ?? "").toString().slice(0, 64);
  const step = (body?.step ?? "").toString();
  const origen = body?.origen === "ads" ? "ads" : "directo";
  const funnel = body?.funnel === "puertas" ? "puertas"
    : body?.funnel === "adultas" ? "adultas"
    : body?.funnel === "jornada" ? "jornada"
    : "inscripcion";
  if (!session_id || !STEPS.has(step)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  // Variante del A/B de titulares (0,1,2…) — solo aplica al funnel de adultas.
  const v = Number(body?.variante);
  const variante = Number.isInteger(v) && v >= 0 && v < 100 ? v : null;
  // Referencia del lead (enlaza el recorrido del checkout con la persona de la landing).
  const lead_ref = typeof body?.lead_ref === "string" ? body.lead_ref.slice(0, 64) : null;
  // Inserta vía service-role (la tabla está cerrada a la clave pública).
  await supabaseAdmin.from("funnel_eventos").insert({ session_id, step, origen, funnel, variante, lead_ref });
  return NextResponse.json({ ok: true });
}
