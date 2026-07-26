import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { contactosDe, enlaceBaja, type SegmentoId } from "@/lib/listas-email";

export const runtime = "nodejs";
export const maxDuration = 30;

async function isAdmin(): Promise<boolean> {
  const s = (await cookies()).get("admin_session");
  return !!s && s.value === process.env.ADMIN_SESSION_SECRET;
}

const SEGMENTOS_OK = ["general", "adultas", "ninas", "madres-crosssell"];

// POST → programa una campaña para una hora futura. Calcula la lista AHORA y la
// guarda; el cron la re-filtra (compradoras/bajas) al enviarla.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const segmento = (body?.segmento ?? "") as SegmentoId;
  const asunto = (body?.asunto ?? "").toString().trim();
  const cuerpo = (body?.cuerpo ?? "").toString().trim();
  const imagenUrl = (body?.imagenUrl ?? "").toString().trim() || null;
  const ctaTexto = (body?.cta?.texto ?? "").toString().trim() || null;
  const ctaUrl = (body?.cta?.url ?? "").toString().trim() || null;
  const cuando = new Date(body?.programadoPara ?? "");

  if (!asunto || !cuerpo) return NextResponse.json({ error: "Falta el asunto o el texto." }, { status: 400 });
  if (!SEGMENTOS_OK.includes(segmento)) return NextResponse.json({ error: "Segmento no válido." }, { status: 400 });
  if (isNaN(cuando.getTime())) return NextResponse.json({ error: "Fecha no válida." }, { status: 400 });
  if (cuando.getTime() < Date.now() + 60 * 1000) {
    return NextResponse.json({ error: "Elige una hora futura (al menos dentro de unos minutos)." }, { status: 400 });
  }

  // Lista de este segmento AHORA (ya sin compradoras ni bajas).
  const contactos = await contactosDe(segmento);
  if (contactos.length === 0) return NextResponse.json({ error: "Ese segmento no tiene destinatarias." }, { status: 400 });

  // Guardamos el enlace de baja YA firmado por destinataria: así el cron (que no
  // tiene el secreto del token) no necesita generarlo.
  const base = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const destinatarios = contactos.map((c) => ({ email: c.email, nombre: c.nombre, baja: enlaceBaja(c.email, base) }));

  const { data, error } = await supabaseAdmin
    .from("email_programadas")
    .insert({
      segmento, asunto, cuerpo,
      imagen_url: imagenUrl, cta_texto: ctaTexto, cta_url: ctaUrl,
      destinatarios,
      programado_para: cuando.toISOString(),
      estado: "pendiente",
    })
    .select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: data.id, destinatarios: contactos.length });
}

// DELETE ?id= → cancela una campaña programada (solo si aún está pendiente).
export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta el id." }, { status: 400 });
  const { error } = await supabaseAdmin
    .from("email_programadas").update({ estado: "cancelada" }).eq("id", id).eq("estado", "pendiente");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
