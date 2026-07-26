import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { contactosDe, type SegmentoId } from "@/lib/listas-email";
import { enviarLote } from "@/lib/email-envio";

export const runtime = "nodejs";
export const maxDuration = 60;

const resend = new Resend(process.env.RESEND_API_KEY);

async function isAdmin(): Promise<boolean> {
  const s = (await cookies()).get("admin_session");
  return !!s && s.value === process.env.ADMIN_SESSION_SECRET;
}

const norm = (e: string) => (e || "").toLowerCase().trim();

// POST → reenvía una campaña SOLO a las direcciones que fallaron (y que siguen
// sin haberla recibido). Como la imagen/CTA no se guardan, se pueden volver a
// pasar en el body. Reusa asunto/cuerpo de la campaña y re-excluye compradoras/bajas.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: "Falta RESEND_API_KEY." }, { status: 500 });

  const body = await req.json().catch(() => null);
  const campanaId = (body?.campanaId ?? "").toString();
  if (!campanaId) return NextResponse.json({ error: "Falta la campaña." }, { status: 400 });

  const imagenUrl = (body?.imagenUrl ?? "").toString().trim();
  const ctaTexto = (body?.cta?.texto ?? "").toString().trim();
  const ctaUrl = (body?.cta?.url ?? "").toString().trim();
  const extra = { imagenUrl, cta: ctaTexto && ctaUrl ? { texto: ctaTexto, url: ctaUrl } : null };

  const { data: camp } = await supabaseAdmin
    .from("email_campanas").select("segmento, asunto, cuerpo").eq("id", campanaId).maybeSingle();
  if (!camp) return NextResponse.json({ error: "Campaña no encontrada." }, { status: 404 });

  // Direcciones que fallaron y aún NO tienen ningún envío correcto en esta campaña.
  const { data: envios } = await supabaseAdmin
    .from("email_envios").select("email, ok").eq("campana_id", campanaId);
  const okSet = new Set<string>();
  const failSet = new Set<string>();
  for (const e of envios ?? []) { const em = norm(e.email as string); if (e.ok) okSet.add(em); else failSet.add(em); }
  const pendientes = new Set([...failSet].filter(e => !okSet.has(e)));
  if (pendientes.size === 0) return NextResponse.json({ ok: true, reenviados: 0, quedan: 0, mensaje: "No queda ninguna dirección fallida." });

  // Nombres + re-exclusión de compradoras/bajas: se cruzan con la lista viva del segmento.
  const lista = (await contactosDe(camp.segmento as SegmentoId)).filter(c => pendientes.has(norm(c.email)));
  if (lista.length === 0) return NextResponse.json({ ok: true, reenviados: 0, quedan: pendientes.size, mensaje: "Las que fallaron ya compraron o se dieron de baja." });

  const base = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
  const { registros, ok, ko } = await enviarLote(resend, lista, { asunto: camp.asunto, cuerpo: camp.cuerpo, extra, base });

  await supabaseAdmin.from("email_envios").insert(registros.map(r => ({ campana_id: campanaId, ...r })));

  // Recalcula los contadores de la campaña con TODOS los envíos (incluidos estos).
  const { data: todos } = await supabaseAdmin.from("email_envios").select("email, ok").eq("campana_id", campanaId);
  const okFinal = new Set<string>(); const allFinal = new Set<string>();
  for (const e of todos ?? []) { const em = norm(e.email as string); allFinal.add(em); if (e.ok) okFinal.add(em); }
  const enviados = okFinal.size;
  const fallidos = allFinal.size - okFinal.size;
  await supabaseAdmin.from("email_campanas").update({ enviados, fallidos }).eq("id", campanaId);

  return NextResponse.json({ ok: true, reenviados: ok, fallosNuevos: ko, quedan: fallidos });
}
