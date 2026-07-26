import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { contactosDe, enlaceBaja, type SegmentoId } from "@/lib/listas-email";
import { plantilla, enviarLote, remitente, REPLY_TO } from "@/lib/email-envio";

export const runtime = "nodejs";
export const maxDuration = 60;

const resend = new Resend(process.env.RESEND_API_KEY);

async function isAdmin(): Promise<boolean> {
  const s = (await cookies()).get("admin_session");
  return !!s && s.value === process.env.ADMIN_SESSION_SECRET;
}

// POST → envía una campaña a un segmento. Si prueba=true, solo al email indicado.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: "Falta RESEND_API_KEY." }, { status: 500 });

  const body = await req.json().catch(() => null);
  const segmento = (body?.segmento ?? "") as SegmentoId;
  const asunto = (body?.asunto ?? "").toString().trim();
  const cuerpo = (body?.cuerpo ?? "").toString().trim();
  const prueba = !!body?.prueba;
  const emailPrueba = (body?.emailPrueba ?? "").toString().trim();

  // Extras opcionales del cuerpo: imagen (URL de nuestro bucket) y botón CTA.
  const imagenUrl = (body?.imagenUrl ?? "").toString().trim();
  const ctaTexto = (body?.cta?.texto ?? "").toString().trim();
  const ctaUrl = (body?.cta?.url ?? "").toString().trim();
  const cta = ctaTexto && ctaUrl ? { texto: ctaTexto, url: ctaUrl } : null;
  const extra = { imagenUrl, cta };

  if (!asunto || !cuerpo) return NextResponse.json({ error: "Falta el asunto o el texto." }, { status: 400 });
  if (!["general", "adultas", "ninas", "madres-crosssell"].includes(segmento)) {
    return NextResponse.json({ error: "Segmento no válido." }, { status: 400 });
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

  // Prueba: un solo correo, sin registrar campaña.
  if (prueba) {
    if (!emailPrueba) return NextResponse.json({ error: "Escribe el email de prueba." }, { status: 400 });
    const { error } = await resend.emails.send({
      from: remitente(), replyTo: REPLY_TO, to: emailPrueba, subject: `[PRUEBA] ${asunto}`,
      html: plantilla("", cuerpo, enlaceBaja(emailPrueba, base), extra),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 502 });
    return NextResponse.json({ ok: true, prueba: true });
  }

  // Envío real: la lista se recalcula AHORA (excluye compradoras y bajas).
  const contactos = await contactosDe(segmento);
  if (contactos.length === 0) return NextResponse.json({ error: "Ese segmento no tiene destinatarias." }, { status: 400 });

  const { data: camp, error: campErr } = await supabaseAdmin
    .from("email_campanas")
    .insert({ segmento, asunto, cuerpo })
    .select("id").single();
  if (campErr || !camp) return NextResponse.json({ error: campErr?.message ?? "No se pudo crear la campaña" }, { status: 500 });

  const { registros, ok, ko } = await enviarLote(resend, contactos, { asunto, cuerpo, extra, base });

  await supabaseAdmin.from("email_envios").insert(registros.map(r => ({ campana_id: camp.id, ...r })));
  await supabaseAdmin.from("email_campanas").update({ enviados: ok, fallidos: ko }).eq("id", camp.id);

  return NextResponse.json({ ok: true, enviados: ok, fallidos: ko, total: contactos.length });
}
