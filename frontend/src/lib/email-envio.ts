import type { Resend } from "resend";
import { enlaceBaja } from "@/lib/listas-email";

// Motor de envío de email marketing, compartido por el envío inmediato y el
// reenvío a los que fallaron (misma plantilla, mismo remitente, mismo ritmo).

const esc = (s: string) => s.replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
const esUrlSegura = (u: string) => /^https?:\/\//i.test((u || "").trim());
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Quita un saludo escrito al principio ("Hola…", "Buenos días…") para no
// duplicarlo con el "¡Hola [nombre]!" de la plantilla. Conservador.
const RE_SALUDO_INICIAL = /^[\s¡!]*(?:hola+|holi+|hey|buenas(?:\s+tardes|\s+noches)?|buenos?\s+d[ií]as)\b[^\n,!:]{0,25}[,!:\n]+[ \t]*\n?/i;

export type ExtraEmail = { imagenUrl?: string; cta?: { texto: string; url: string } | null };
export const REPLY_TO = "andreacarriostudio@gmail.com";

// Remitente con nombre visible ("Andrea Carrió Studio").
export function remitente(): string {
  const fromEmail = process.env.FROM_EMAIL ?? "onboarding@resend.dev";
  return fromEmail.includes("<") ? fromEmail : `Andrea Carrió Studio <${fromEmail}>`;
}

// Monta el email con la identidad del estudio y el enlace de baja obligatorio.
export function plantilla(nombre: string, cuerpo: string, urlBaja: string, extra: ExtraEmail = {}) {
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

export type EnvioResultado = { email: string; ok: boolean; error: string | null };

// Envía a una lista respetando el límite de Resend (10/seg): tandas de 8 con
// ~1,1s de pausa y un reintento si rebota. Devuelve un registro por destinataria.
export async function enviarLote(
  resend: Resend,
  contactos: { email: string; nombre: string }[],
  opts: { asunto: string; cuerpo: string; extra: ExtraEmail; base: string },
): Promise<{ registros: EnvioResultado[]; ok: number; ko: number }> {
  const from = remitente();
  const { asunto, cuerpo, extra, base } = opts;
  const LOTE = 8;

  const enviarUno = async (c: { email: string; nombre: string }): Promise<EnvioResultado> => {
    for (let intento = 0; intento < 2; intento++) {
      try {
        const { error } = await resend.emails.send({
          from, replyTo: REPLY_TO, to: c.email, subject: asunto,
          html: plantilla(c.nombre, cuerpo, enlaceBaja(c.email, base), extra),
          headers: { "List-Unsubscribe": `<${enlaceBaja(c.email, base)}>` },
        });
        if (!error) return { email: c.email, ok: true, error: null };
        if (intento === 0 && /too many|rate/i.test(error.message)) { await sleep(1300); continue; }
        return { email: c.email, ok: false, error: error.message };
      } catch (e) {
        if (intento === 0) { await sleep(1300); continue; }
        return { email: c.email, ok: false, error: e instanceof Error ? e.message : "error" };
      }
    }
    return { email: c.email, ok: false, error: "no enviado" };
  };

  const registros: EnvioResultado[] = [];
  let ok = 0, ko = 0;
  for (let i = 0; i < contactos.length; i += LOTE) {
    const res = await Promise.all(contactos.slice(i, i + LOTE).map(enviarUno));
    for (const r of res) { if (r.ok) ok++; else ko++; registros.push(r); }
    if (i + LOTE < contactos.length) await sleep(1100);
  }
  return { registros, ok, ko };
}
