import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { contactosDe, resumenSegmentos, type SegmentoId } from "@/lib/listas-email";

async function isAdmin(): Promise<boolean> {
  const s = (await cookies()).get("admin_session");
  return !!s && s.value === process.env.ADMIN_SESSION_SECRET;
}

// GET            → resumen de segmentos (con totales) + últimas campañas
// GET ?segmento= → contactos de ese segmento
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const seg = req.nextUrl.searchParams.get("segmento") as SegmentoId | null;
  if (seg) {
    const contactos = await contactosDe(seg);
    return NextResponse.json({ contactos });
  }

  const [resumen, campanas, programadas] = await Promise.all([
    resumenSegmentos(),
    supabaseAdmin.from("email_campanas").select("*").order("created_at", { ascending: false }).limit(10),
    supabaseAdmin.from("email_programadas")
      .select("id, segmento, asunto, programado_para, estado, destinatarios")
      .eq("estado", "pendiente").order("programado_para", { ascending: true }),
  ]);
  const prog = (programadas.data ?? []).map((p) => ({
    id: p.id, segmento: p.segmento, asunto: p.asunto, programado_para: p.programado_para,
    destinatarios: Array.isArray(p.destinatarios) ? p.destinatarios.length : 0,
  }));

  // Aperturas y clics por campaña (para open rate / click rate).
  const ids = (campanas.data ?? []).map((c) => c.id);
  const abiertos = new Map<string, number>();
  const clics = new Map<string, number>();
  if (ids.length) {
    const { data: ev } = await supabaseAdmin
      .from("email_envios").select("campana_id, abierto_at, clic_at").in("campana_id", ids);
    for (const e of ev ?? []) {
      if (e.abierto_at) abiertos.set(e.campana_id, (abiertos.get(e.campana_id) ?? 0) + 1);
      if (e.clic_at) clics.set(e.campana_id, (clics.get(e.campana_id) ?? 0) + 1);
    }
  }
  const camps = (campanas.data ?? []).map((c) => ({
    ...c, abiertos: abiertos.get(c.id) ?? 0, clics: clics.get(c.id) ?? 0,
  }));
  return NextResponse.json({ ...resumen, campanas: camps, programadas: prog });
}
