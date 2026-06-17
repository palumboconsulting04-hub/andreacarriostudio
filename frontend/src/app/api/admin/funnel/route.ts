import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function isAdmin(): Promise<boolean> {
  const session = (await cookies()).get("admin_session");
  return !!session && session.value === process.env.ADMIN_SESSION_SECRET;
}

// Orden y etiquetas de los pasos de cada embudo.
const PASOS: Record<string, { step: string; label: string }[]> = {
  inscripcion: [
    { step: "paso1_disciplina", label: "1. Disciplina" },
    { step: "paso2_plan", label: "2. Plan" },
    { step: "paso3_horarios", label: "3. Horarios" },
    { step: "paso4_crosssell", label: "4. ¿Otra clase?" },
    { step: "paso5_pago", label: "5. Datos y pago" },
    { step: "compra", label: "6. Compra" },
  ],
  puertas: [
    { step: "pa_visita", label: "1. Visita" },
    { step: "pa_click", label: "2. Pulsó reservar" },
    { step: "pa_reserva", label: "3. Reserva completada" },
  ],
};

// Devuelve el embudo: sesiones únicas que han llegado a cada paso.
// Filtro de fecha opcional: ?desde=ISO&hasta=ISO. Sin filtro = todo el histórico.
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const sp = req.nextUrl.searchParams;
  const desde = sp.get("desde");
  const hasta = sp.get("hasta");
  const origen = sp.get("origen"); // "ads" | "directo" | null (todos)
  const funnelTipo = sp.get("funnel") === "puertas" ? "puertas" : "inscripcion";

  let q = supabaseAdmin.from("funnel_eventos").select("session_id, step").eq("funnel", funnelTipo);
  if (desde) q = q.gte("created_at", desde);
  if (hasta) q = q.lte("created_at", hasta);
  if (origen === "ads" || origen === "directo") q = q.eq("origen", origen);
  const { data, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Sesiones únicas por paso.
  const sesiones: Record<string, Set<string>> = {};
  for (const r of data ?? []) {
    (sesiones[r.step] ??= new Set()).add(r.session_id);
  }
  const funnel = PASOS[funnelTipo].map(p => ({
    step: p.step,
    label: p.label,
    count: sesiones[p.step]?.size ?? 0,
  }));

  return NextResponse.json({ data: funnel });
}
