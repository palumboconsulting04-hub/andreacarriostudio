import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://reservas.andreacarriostudio.es";
const DISC_LABEL: Record<string, string> = { "barre-fit": "Barre Fit", "pilates-mat": "Pilates Mat" };

// Crea el bono en la base a partir de una Checkout Session pagada. Idempotente por
// stripe_session_id (lo llaman tanto el webhook como el endpoint de confirmación).
// Luego envía el email con el acceso al panel. No lanza si el email falla.
export async function procesarBonoPagado(session: Stripe.Checkout.Session): Promise<void> {
  if (session.metadata?.tipo !== "compra-bono") return;
  if (session.payment_status !== "paid") return;

  const m = session.metadata as Record<string, string>;

  const { data: existe } = await supabaseAdmin
    .from("bonos").select("id").eq("stripe_session_id", session.id).maybeSingle();
  if (existe) return; // ya creado (webhook + confirm, o reintento)

  const creditos = parseInt(m.creditos ?? "0", 10) || 0;
  const validez = parseInt(m.validez_meses ?? "1", 10) || 1;
  const caduca = new Date();
  caduca.setMonth(caduca.getMonth() + validez);
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;

  const { error } = await supabaseAdmin.from("bonos").insert({
    bono_tipo_id: m.bono_tipo_id ?? null,
    disciplina_id: m.disciplina_id ?? "",
    nombre: m.nombre ?? "",
    email: (m.email ?? "").toLowerCase(),
    telefono: m.telefono || null,
    creditos_totales: creditos,
    creditos_restantes: creditos,
    caduca: caduca.toISOString().slice(0, 10),
    precio_pagado: parseFloat(m.precio ?? "0") || null,
    stripe_session_id: session.id,
    stripe_payment_intent_id: pi,
    estado: "activo",
  });
  // 23505 = unique_violation: otra ejecución lo creó a la vez → no es error.
  if (error && error.code !== "23505") throw error;
  if (error) return;

  try { await enviarEmailBono(m, creditos, caduca); } catch (e) { console.error("email bono:", e); }
}

async function enviarEmailBono(m: Record<string, string>, creditos: number, caduca: Date) {
  if (!m.email) return;
  const from = process.env.FROM_EMAIL ?? "onboarding@resend.dev";
  const disc = DISC_LABEL[m.disciplina_id] ?? m.disciplina_id;
  const caducaStr = caduca.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  const panel = `${APP_URL}/mis-clases`;
  const creditosTxt = creditos === 1 ? "1 clase" : `${creditos} clases`;

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f5ede8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5ede8;padding:40px 16px;"><tr><td align="center">
    <table width="100%" style="max-width:520px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 40px rgba(37,25,15,0.10);">
      <tr><td style="padding:36px 40px 8px;text-align:center;"><img src="https://andreacarriostudio.vercel.app/logo-email.png" alt="Andrea Carrió Studio" width="150" style="display:block;margin:0 auto;width:150px;" /></td></tr>
      <tr><td style="padding:20px 40px 8px;text-align:center;">
        <h1 style="margin:0 0 12px;font-size:26px;font-weight:600;color:#25190f;font-family:Georgia,serif;">¡Hola ${m.nombre ?? ""}! 🤎</h1>
        <p style="margin:0;font-size:15px;color:#56423d;line-height:1.7;">Tu bono ya está activo. Reserva tus clases cuando quieras desde tu panel.</p>
      </td></tr>
      <tr><td style="padding:20px 32px 8px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff1e9;border-radius:16px;">
          <tr><td style="padding:18px 22px;">
            <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#89726c;font-weight:700;">Tu bono</p>
            <p style="margin:0;font-size:18px;font-weight:700;color:#7d2b13;">${m.nombre ?? "Bono"} · ${disc}</p>
            <p style="margin:8px 0 0;font-size:14px;color:#25190f;">🎟️ ${creditosTxt} disponibles</p>
            <p style="margin:2px 0 0;font-size:13px;color:#89726c;">Válido hasta el ${caducaStr}</p>
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:16px 32px 8px;">
        <p style="margin:0;font-size:14px;color:#56423d;line-height:1.7;">Para reservar, entra en tu panel con <strong>este mismo correo</strong> (${m.email}). Te llegará un enlace de acceso, eliges el día y ¡listo!</p>
      </td></tr>
      <tr><td style="padding:16px 32px 36px;text-align:center;">
        <a href="${panel}" style="display:inline-block;background:#7d2b13;color:#fff8f5;text-decoration:none;font-size:14px;font-weight:700;letter-spacing:.5px;padding:15px 40px;border-radius:9999px;">Reservar mis clases →</a>
      </td></tr>
      <tr><td style="background:#fff8f5;border-top:1px solid #f0ddd5;padding:24px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#25190f;">Andrea Carrió Studio</p>
        <p style="margin:5px 0 0;font-size:11px;color:#89726c;">C/ Motilla del Palancar 34, Alfahuir (Valencia)</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  await resend.emails.send({
    from,
    to: m.email,
    subject: `Tu ${m.nombre ?? "bono"} de ${disc} ya está activo 🤎`,
    html,
  });
}
