import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { contactosDe, enlaceBaja, type SegmentoId } from "@/lib/listas-email";

export const runtime = "nodejs";
export const maxDuration = 60;

const resend = new Resend(process.env.RESEND_API_KEY);

async function isAdmin(): Promise<boolean> {
  const s = (await cookies()).get("admin_session");
  return !!s && s.value === process.env.ADMIN_SESSION_SECRET;
}

const esc = (s: string) => s.replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));

// Quita un saludo escrito al principio del texto ("Hola…", "Buenos días…"), para
// no duplicarlo con el "¡Hola [nombre]!" que pone la plantilla. Conservador: solo
// si es un saludo corto terminado en coma/exclamación/salto de línea.
const RE_SALUDO_INICIAL = /^[\s¡!]*(?:hola+|holi+|hey|buenas(?:\s+tardes|\s+noches)?|buenos?\s+d[ií]as)\b[^\n,!:]{0,25}[,!:\n]+[ \t]*\n?/i;

// Solo dejamos pasar URLs http(s) (evita javascript: y demás en imagen / CTA).
const esUrlSegura = (u: string) => /^https?:\/\//i.test((u || "").trim());

type ExtraEmail = { imagenUrl?: string; cta?: { texto: string; url: string } | null };

// Monta el email con la identidad del estudio y el enlace de baja obligatorio.
function plantilla(nombre: string, cuerpo: string, urlBaja: string, extra: ExtraEmail = {}) {
  const saludo = nombre ? `¡Hola ${esc(nombre.split(" ")[0])}!` : "¡Hola!";
  const cuerpoLimpio = cuerpo.replace(RE_SALUDO_INICIAL, "");
  const parrafos = cuerpoLimpio.split(/\n{2,}/).map(p => `<p style="margin:0 0 16px;line-height:1.65;">${esc(p).replace(/\n/g, "<br/>")}</p>`).join("");
  const imagen = extra.imagenUrl && esUrlSegura(extra.imagenUrl)
    ? `<img src="${extra.imagenUrl}" alt="" style="width:100%;max-width:512px;border-radius:14px;display:block;margin:0 0 22px;" />`
    : "";
  const cta = extra.cta && extra.cta.texto && esUrlSegura(extra.cta.url)
    ? `<div style="text-align:center;margin:26px 0 4px;"><a href="${extra.cta.url}" style="display:inline-block;background:#7d2b13;color:#fff8f5;text-decoration:none;font-size:15px;font-weight:700;padding:14px 34px;border-radius:9999px;">${esc(extra.cta.texto)} →</a></div>`
    : "";
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#25190f;max-width:560px;margin:0 auto;padding:28px 24px;background:#fff8f5;">
  ${imagen}
  <p style="font-size:13px;letter-spacing:2px;color:#7d2b13;font-weight:700;margin:0 0 20px;">ANDREA CARRIÓ STUDIO</p>
  <p style="margin:0 0 16px;font-size:16px;font-weight:600;">${saludo}</p>
  <div style="font-size:15px;color:#3d2b23;">${parrafos}</div>
  ${cta}
  <p style="margin:24px 0 0;font-size:15px;color:#3d2b23;line-height:1.6;">Un abrazo,<br/><strong style="color:#7d2b13;">Andrea</strong> 🤎</p>
  <div style="margin-top:28px;padding-top:18px;border-top:1px solid #dcc1b9;font-size:12px;color:#89726c;line-height:1.6;">
    Andrea Carrió Studio · Danza &amp; Pilates · C/ Motilla del Palancar 34 bajo, 46019 Valencia<br/>
    ¿No quieres recibir más correos? <a href="${urlBaja}" style="color:#7d2b13;">Darme de baja</a>
  </div>
</div>`;
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

  // Remitente con nombre visible ("Andrea Carrió Studio") y responder-a su Gmail,
  // para que si una madre contesta, le llegue a Andrea (nada de "noreply" mudo).
  const fromEmail = process.env.FROM_EMAIL ?? "onboarding@resend.dev";
  const from = fromEmail.includes("<") ? fromEmail : `Andrea Carrió Studio <${fromEmail}>`;
  const replyTo = "andreacarriostudio@gmail.com";
  const base = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

  // Prueba: un solo correo, sin registrar campaña.
  if (prueba) {
    if (!emailPrueba) return NextResponse.json({ error: "Escribe el email de prueba." }, { status: 400 });
    const { error } = await resend.emails.send({
      from, replyTo, to: emailPrueba, subject: `[PRUEBA] ${asunto}`,
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

  let ok = 0, ko = 0;
  const registros: { campana_id: string; email: string; ok: boolean; error: string | null }[] = [];
  // De 20 en 20 para no saturar el límite de Resend.
  for (let i = 0; i < contactos.length; i += 20) {
    const lote = contactos.slice(i, i + 20);
    const res = await Promise.all(lote.map(async (c) => {
      try {
        const { error } = await resend.emails.send({
          from, replyTo, to: c.email, subject: asunto,
          html: plantilla(c.nombre, cuerpo, enlaceBaja(c.email, base), extra),
          headers: { "List-Unsubscribe": `<${enlaceBaja(c.email, base)}>` },
        });
        return { email: c.email, ok: !error, error: error?.message ?? null };
      } catch (e) {
        return { email: c.email, ok: false, error: e instanceof Error ? e.message : "error" };
      }
    }));
    for (const r of res) {
      if (r.ok) ok++; else ko++;
      registros.push({ campana_id: camp.id, email: r.email, ok: r.ok, error: r.error });
    }
  }

  await supabaseAdmin.from("email_envios").insert(registros);
  await supabaseAdmin.from("email_campanas").update({ enviados: ok, fallidos: ko }).eq("id", camp.id);

  return NextResponse.json({ ok: true, enviados: ok, fallidos: ko, total: contactos.length });
}
