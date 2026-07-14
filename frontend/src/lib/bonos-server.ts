import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { Resend } from "resend";
import { emailDeCodigo, getCodigoReferido } from "@/lib/referidos";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://reservas.andreacarriostudio.es";
const DISC_LABEL: Record<string, string> = { "barre-fit": "Barre Fit", "pilates-mat": "Pilates Mat" };
// Los bonos del curso arrancan el 1 de septiembre de 2026. Si se compra antes, la
// validez cuenta desde esa fecha (no desde la compra) y no se puede usar antes.
export const BONO_INICIO_CURSO = "2026-09-01";

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
  // Arranca el 1-sep si se compra antes; si no, hoy. La validez cuenta desde ahí.
  const hoy = new Date().toISOString().slice(0, 10);
  const validoDesde = hoy < BONO_INICIO_CURSO ? BONO_INICIO_CURSO : hoy;
  const caduca = new Date(`${validoDesde}T00:00:00Z`);
  caduca.setUTCMonth(caduca.getUTCMonth() + validez);
  const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;

  // Referido: si trae un código de madrina válido (y no es autorreferido), lo guardamos.
  const emailComprador = (m.email ?? "").toLowerCase();
  let referidoPor: string | null = null;
  let emailMadrina: string | null = null;
  if (m.ref) {
    const e = await emailDeCodigo(m.ref);
    if (e && e !== emailComprador) { referidoPor = m.ref.toUpperCase(); emailMadrina = e; }
  }

  const { error } = await supabaseAdmin.from("bonos").insert({
    bono_tipo_id: m.bono_tipo_id ?? null,
    disciplina_id: m.disciplina_id ?? "",
    nombre: m.nombre ?? "",
    email: emailComprador,
    telefono: m.telefono || null,
    creditos_totales: creditos,
    creditos_restantes: creditos,
    valido_desde: validoDesde,
    caduca: caduca.toISOString().slice(0, 10),
    referido_por: referidoPor,
    precio_pagado: parseFloat(m.precio ?? "0") || null,
    stripe_session_id: session.id,
    stripe_payment_intent_id: pi,
    estado: "activo",
  });
  // 23505 = unique_violation: otra ejecución lo creó a la vez → no es error.
  if (error && error.code !== "23505") throw error;
  if (error) return;

  try { await enviarEmailBono(m, creditos, caduca, validoDesde, !!referidoPor && creditos >= 5); } catch (e) { console.error("email bono:", e); }
  try { await enviarAvisoAdmin(m, creditos, caduca); } catch (e) { console.error("aviso admin bono:", e); }
  // La compradora recibe su propio código de madrina para poder invitar a amigas.
  try { await getCodigoReferido(emailComprador, m.nombre ?? ""); } catch (e) { console.error("codigo referido:", e); }

  // Fase 2 — premio de referido: solo con Bono 5/12 (nunca clase suelta).
  if (referidoPor && emailMadrina && creditos >= 5) {
    try { await aplicarPremioReferido(emailMadrina, emailComprador, m.nombre ?? "", m.disciplina_id ?? "", validoDesde); }
    catch (e) { console.error("premio referido:", e); }
  }
}

// Crea un bono de 1 crédito de regalo (referido). Caduca a los 2 meses del arranque.
// Devuelve el id del bono creado (o null si falla).
export async function crearBonoRegalo(email: string, nombre: string, disciplina: string, validoDesde: string): Promise<string | null> {
  const caduca = new Date(`${validoDesde}T00:00:00Z`);
  caduca.setUTCMonth(caduca.getUTCMonth() + 2);
  const { data, error } = await supabaseAdmin.from("bonos").insert({
    bono_tipo_id: null,
    disciplina_id: disciplina,
    nombre,
    email: email.toLowerCase(),
    creditos_totales: 1,
    creditos_restantes: 1,
    valido_desde: validoDesde,
    caduca: caduca.toISOString().slice(0, 10),
    precio_pagado: 0,
    estado: "activo",
  }).select("id").maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

// Premio de bienvenida para la amiga que entra por MENSUALIDAD (adultas barre/pilates):
// +1 clase de la OTRA disciplina, para que pruebe algo nuevo (cross-sell). En niñas
// (ballet) no hay bonos, así que no se da automático (se gestiona a mano). Solo debe
// llamarse si la inscripción vino de un referido válido (iscrizioni.referido_por).
export async function premioBienvenidaAmigaMensualidad(email: string, nombre: string, disciplinas: string[]): Promise<void> {
  if (!email) return;
  const set = new Set(disciplinas);
  let regalo: string | null = null;
  if (set.has("barre-fit") && !set.has("pilates-mat")) regalo = "pilates-mat";
  else if (set.has("pilates-mat") && !set.has("barre-fit")) regalo = "barre-fit";
  // Tiene ambas, o ninguna de barre/pilates (p. ej. niñas): no hay clase nueva que regalar.
  if (!regalo) return;
  const hoy = new Date().toISOString().slice(0, 10);
  const validoDesde = hoy < BONO_INICIO_CURSO ? BONO_INICIO_CURSO : hoy;
  await crearBonoRegalo(email, nombre, regalo, validoDesde);
}

// Aplica el premio de referido: +1 clase de regalo a la madrina y a la amiga, y avisa a la madrina.
async function aplicarPremioReferido(emailMadrina: string, amigaEmail: string, amigaNombre: string, disciplina: string, validoDesde: string) {
  const { data: mad } = await supabaseAdmin
    .from("referidos_codigo").select("nombre").eq("email", emailMadrina).maybeSingle();
  const nombreMadrina = mad?.nombre ?? "";
  await crearBonoRegalo(emailMadrina, nombreMadrina, disciplina, validoDesde);
  await crearBonoRegalo(amigaEmail, amigaNombre, disciplina, validoDesde);
  try { await enviarEmailPremioMadrina(emailMadrina, nombreMadrina, amigaNombre, disciplina); }
  catch (e) { console.error("email premio madrina:", e); }
}

// Aviso a la madrina de que su amiga se apuntó y tiene 1 clase de regalo.
async function enviarEmailPremioMadrina(email: string, nombreMadrina: string, amigaNombre: string, disciplina: string) {
  const from = process.env.FROM_EMAIL ?? "onboarding@resend.dev";
  const disc = DISC_LABEL[disciplina] ?? disciplina;
  const panel = `${APP_URL}/mis-clases?entrar=1&email=${encodeURIComponent(email)}`;
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f5ede8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5ede8;padding:40px 16px;"><tr><td align="center">
    <table width="100%" style="max-width:520px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 40px rgba(37,25,15,0.10);">
      <tr><td style="padding:34px 40px 8px;text-align:center;">
        <h1 style="margin:0 0 12px;font-size:24px;font-weight:600;color:#25190f;font-family:Georgia,serif;">¡Gracias por invitar${nombreMadrina ? `, ${nombreMadrina}` : ""}! 🤎</h1>
        <p style="margin:0;font-size:15px;color:#56423d;line-height:1.7;">Tu amiga <strong>${amigaNombre || "una amiga"}</strong> se ha apuntado con tu código, así que te hemos añadido <strong>1 clase de regalo de ${disc}</strong> en tu área "Mis clases".</p>
      </td></tr>
      <tr><td style="padding:20px 32px 36px;text-align:center;">
        <a href="${panel}" style="display:inline-block;background:#7d2b13;color:#fff8f5;text-decoration:none;font-size:14px;font-weight:700;padding:15px 40px;border-radius:9999px;">Ver mi clase de regalo →</a>
      </td></tr>
      <tr><td style="background:#fff8f5;border-top:1px solid #f0ddd5;padding:24px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#25190f;">Andrea Carrió Studio</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  await resend.emails.send({ from, to: email, subject: `¡${amigaNombre || "Tu amiga"} se ha apuntado! Tienes 1 clase de regalo 🤎`, html });
}

// Aviso a Andrea de cada compra de bono (mismo buzón que las matrículas nuevas).
async function enviarAvisoAdmin(m: Record<string, string>, creditos: number, caduca: Date) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!adminEmail) return;
  const from = process.env.FROM_EMAIL ?? "onboarding@resend.dev";
  const disc = DISC_LABEL[m.disciplina_id] ?? m.disciplina_id;
  const caducaStr = caduca.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  const creditosTxt = creditos === 1 ? "1 clase" : `${creditos} clases`;
  const precio = m.precio ? `${m.precio}€` : "—";

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8" /></head><body style="font-family:Arial,sans-serif;color:#333;max-width:520px;margin:0 auto;padding:24px;">
<h2 style="margin:0 0 4px;color:#7d2b13;">Nueva compra de bono</h2>
<p style="margin:0 0 20px;font-size:13px;color:#888;">${new Date().toLocaleString("es-ES")}</p>
<table width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #7d2b13;">
  <tr><td style="font-size:13px;color:#666;padding:8px 0 4px;">Cliente</td><td style="font-size:13px;font-weight:600;text-align:right;padding:8px 0 4px;">${m.nombre || "—"}</td></tr>
  <tr><td style="font-size:13px;color:#666;padding:4px 0;">Email</td><td style="font-size:13px;text-align:right;"><a href="mailto:${m.email}">${m.email}</a></td></tr>
  ${m.telefono ? `<tr><td style="font-size:13px;color:#666;padding:4px 0;">Teléfono</td><td style="font-size:13px;text-align:right;"><a href="tel:${m.telefono}">${m.telefono}</a></td></tr>` : ""}
  <tr><td style="font-size:13px;color:#666;padding:4px 0;">Bono</td><td style="font-size:13px;font-weight:600;text-align:right;">${disc} · ${creditosTxt}</td></tr>
  <tr><td style="font-size:13px;color:#666;padding:4px 0;">Importe</td><td style="font-size:13px;font-weight:600;text-align:right;">${precio}</td></tr>
  <tr><td style="font-size:13px;color:#666;padding:4px 0 8px;">Válido hasta</td><td style="font-size:13px;text-align:right;padding:4px 0 8px;">${caducaStr}</td></tr>
</table>
</body></html>`;

  await resend.emails.send({
    from,
    to: adminEmail,
    subject: `Nueva compra de bono — ${m.nombre || m.email}`,
    html,
  });
}

async function enviarEmailBono(m: Record<string, string>, creditos: number, caduca: Date, validoDesde: string, esReferida = false) {
  if (!m.email) return;
  const from = process.env.FROM_EMAIL ?? "onboarding@resend.dev";
  const disc = DISC_LABEL[m.disciplina_id] ?? m.disciplina_id;
  const caducaStr = caduca.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  // Siempre al login (entrar=1) → cada persona entra en SU panel, no con una sesión previa.
  const panel = `${APP_URL}/mis-clases?entrar=1&email=${encodeURIComponent(m.email)}`;
  const creditosTxt = creditos === 1 ? "1 clase" : `${creditos} clases`;
  const porEmpezar = !!validoDesde && validoDesde > new Date().toISOString().slice(0, 10);
  const inicioStr = validoDesde ? new Date(`${validoDesde}T00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long" }) : "";

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f5ede8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5ede8;padding:40px 16px;"><tr><td align="center">
    <table width="100%" style="max-width:520px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 40px rgba(37,25,15,0.10);">
      <tr><td style="padding:36px 40px 8px;text-align:center;"><img src="https://andreacarriostudio.vercel.app/logo-email.png" alt="Andrea Carrió Studio" width="150" style="display:block;margin:0 auto;width:150px;" /></td></tr>
      <tr><td style="padding:20px 40px 8px;text-align:center;">
        <h1 style="margin:0 0 12px;font-size:26px;font-weight:600;color:#25190f;font-family:Georgia,serif;">¡Hola ${m.nombre ?? ""}! 🤎</h1>
        <p style="margin:0;font-size:15px;color:#56423d;line-height:1.7;">${porEmpezar ? `Tu bono queda reservado y <strong>empieza el ${inicioStr}</strong>. Podrás reservar tus clases a partir de esa fecha.` : "Tu bono ya está activo. Reserva tus clases cuando quieras desde tu panel."}</p>
        ${esReferida ? `<p style="margin:12px 0 0;font-size:14px;font-weight:700;color:#7d2b13;">🎁 Y como vienes de una amiga, tienes 1 clase de regalo extra.</p>` : ""}
      </td></tr>
      <tr><td style="padding:20px 32px 8px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff1e9;border-radius:16px;">
          <tr><td style="padding:18px 22px;">
            <p style="margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:2px;color:#89726c;font-weight:700;">Tu bono</p>
            <p style="margin:0;font-size:18px;font-weight:700;color:#7d2b13;">${m.nombre ?? "Bono"} · ${disc}</p>
            <p style="margin:8px 0 0;font-size:14px;color:#25190f;">🎟️ ${creditosTxt} disponibles</p>
            ${porEmpezar ? `<p style="margin:2px 0 0;font-size:13px;color:#7d2b13;font-weight:700;">Empieza el ${inicioStr}</p>` : ""}
            <p style="margin:2px 0 0;font-size:13px;color:#89726c;">Válido hasta el ${caducaStr}</p>
            ${m.precio ? `<p style="margin:2px 0 0;font-size:13px;color:#89726c;">Importe pagado: ${m.precio}€</p>` : ""}
          </td></tr>
        </table>
      </td></tr>
      <tr><td style="padding:16px 32px 8px;">
        <p style="margin:0;font-size:14px;color:#56423d;line-height:1.7;">Para reservar, entra en tu panel con <strong>tu correo</strong> (${m.email}) y <strong>tu nombre</strong>, eliges el día y ¡listo!</p>
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
