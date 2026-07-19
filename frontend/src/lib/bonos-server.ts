import type Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { stripe } from "@/lib/stripe";
import { Resend } from "resend";
import { emailDeCodigo, getCodigoReferido, enlaceInvita } from "@/lib/referidos";

// Descuento en la cuota (mensualidad) por traer/venir de una amiga: 10€.
const DESCUENTO_CUOTA_CENT = 1000;

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

  // Premio de referido: solo con Bono 5/12 (nunca clase suelta) y si la amiga es NUEVA.
  if (referidoPor && emailMadrina && creditos >= 5) {
    try {
      if (await esClienteNueva(emailComprador, { excluirBonoSession: session.id })) {
        await premiarReferidoBono(referidoPor, emailComprador, m.nombre ?? "", m.disciplina_id ?? "", validoDesde);
      }
    } catch (e) { console.error("premio referido bono:", e); }
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

// ── Premios del programa "Trae a tu amiga" ──
// Regla: cada persona gana según lo que tiene → 10€ en su cuota si paga mensualidad,
// o 1 clase si es de bono. Todo automático.

// Cliente de Stripe de una persona si paga mensualidad (para descuentos de cuota).
async function customerDeMensualidad(email: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("iscrizioni").select("stripe_customer_id")
    .eq("email", email.toLowerCase()).not("stripe_customer_id", "is", null)
    .limit(1).maybeSingle();
  return data?.stripe_customer_id ?? null;
}

// Disciplina del último bono de una persona (para el regalo de clase). Barre por defecto.
async function disciplinaBonoDe(email: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from("bonos").select("disciplina_id")
    .eq("email", email.toLowerCase()).order("created_at", { ascending: false })
    .limit(1).maybeSingle();
  return data?.disciplina_id ?? "barre-fit";
}

function validoDesdeHoy(): string {
  const hoy = new Date().toISOString().slice(0, 10);
  return hoy < BONO_INICIO_CURSO ? BONO_INICIO_CURSO : hoy;
}

// Registra un premio otorgado (histórico + idempotencia del mes gratis + poder
// revertirlo si la amiga que lo originó pide un reembolso).
async function registrarPremio(codigo: string, email: string, tipo: string, detalle: string, importeCent: number | null, customerId: string | null, txnId: string | null, bonoId: string | null, amigaEmail: string | null = null) {
  await supabaseAdmin.from("premios_referido").insert({
    madrina_codigo: codigo, madrina_email: email, tipo, detalle,
    importe_cent: importeCent, stripe_customer_id: customerId,
    stripe_balance_txn_id: txnId, bono_id: bonoId, amiga_email: (amigaEmail ?? "").toLowerCase() || null,
  });
}

// ¿Es la amiga una clienta NUEVA? (aparte de esta compra, sin otro bono comprado ni
// otra inscripción de mensualidad). Evita premiar a clientas existentes o a quien se
// autorregala con otra compra.
export async function esClienteNueva(email: string, opts: { excluirBonoSession?: string; excluirPi?: string }): Promise<boolean> {
  const em = (email || "").toLowerCase();
  if (!em) return false;
  const { data: bonos } = await supabaseAdmin
    .from("bonos").select("stripe_session_id").ilike("email", em).gt("precio_pagado", 0);
  if ((bonos ?? []).some((b) => b.stripe_session_id !== opts.excluirBonoSession)) return false;
  const { data: iscr } = await supabaseAdmin
    .from("iscrizioni").select("stripe_payment_intent_id, stato").ilike("email", em);
  const previa = (iscr ?? []).some((i) =>
    i.stripe_payment_intent_id !== opts.excluirPi &&
    ["matricula_pagada", "activa", "impago", "cancelada", "pagado"].includes(i.stato ?? ""));
  if (previa) return false;
  return true;
}

// Revierte los premios de la madrina originados por una amiga (cuando la amiga pide
// un reembolso): devuelve el crédito de cuota en Stripe y anula el bono de regalo.
export async function revertirPremiosReferido(amigaEmail: string) {
  const em = (amigaEmail || "").toLowerCase();
  if (!em) return;
  const { data: premios } = await supabaseAdmin
    .from("premios_referido").select("id, importe_cent, stripe_customer_id, bono_id").ilike("amiga_email", em);
  for (const p of premios ?? []) {
    if (p.stripe_customer_id && p.importe_cent) {
      try {
        await stripe.customers.createBalanceTransaction(p.stripe_customer_id, {
          amount: p.importe_cent, currency: "eur", description: "Reverso Trae a tu amiga (reembolso de la amiga)",
        });
      } catch (e) { console.error("reverso saldo:", e); }
    }
    if (p.bono_id) {
      try { await supabaseAdmin.from("bonos").update({ creditos_restantes: 0, estado: "anulado" }).eq("id", p.bono_id); } catch (e) { console.error("reverso bono:", e); }
    }
  }
  await supabaseAdmin.from("premios_referido").delete().ilike("amiga_email", em);
}

const TOPE_PREMIOS_MES = 10;   // máx premios por madrina al mes (anti-abuso)
const AMIGAS_EMBAJADORA = 5;   // 5 amigas → mes gratis (aviso a Andrea)

// Nº de amigas distintas que ha traído un código (bono + mensualidad).
async function contarAmigas(codigo: string): Promise<number> {
  const [b, i] = await Promise.all([
    supabaseAdmin.from("bonos").select("email").eq("referido_por", codigo),
    supabaseAdmin.from("iscrizioni").select("email").eq("referido_por", codigo),
  ]);
  return new Set([
    ...(b.data ?? []).map((r) => (r.email ?? "").toLowerCase()),
    ...(i.data ?? []).map((r) => (r.email ?? "").toLowerCase()),
  ].filter(Boolean)).size;
}

// Aviso por email a Andrea (mismo buzón que las compras).
async function avisoAdmin(asunto: string, cuerpoHtml: string) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!adminEmail) return;
  const from = process.env.FROM_EMAIL ?? "onboarding@resend.dev";
  await resend.emails.send({ from, to: adminEmail, subject: asunto, html: `<div style="font-family:Arial,sans-serif;color:#333;max-width:520px;margin:0 auto;padding:24px;">${cuerpoHtml}</div>` });
}

// Premia a la MADRINA según SU tipo: 10€ en su cuota (mensualidad) o 1 clase (bono).
export async function premiarMadrina(codigo: string, amigaEmail: string) {
  const { data: mad } = await supabaseAdmin
    .from("referidos_codigo").select("email, nombre").eq("codigo", codigo).maybeSingle();
  const emailMadrina = (mad?.email ?? "").toLowerCase();
  if (!emailMadrina || emailMadrina === amigaEmail.toLowerCase()) return; // sin madrina o autorreferido
  const nombreMadrina = mad?.nombre ?? "";

  // Tope anti-abuso: no más de TOPE_PREMIOS_MES premios por madrina al mes.
  const inicioMes = new Date(); inicioMes.setUTCDate(1); inicioMes.setUTCHours(0, 0, 0, 0);
  const { count: premiosMes } = await supabaseAdmin
    .from("premios_referido").select("id", { count: "exact", head: true })
    .eq("madrina_codigo", codigo).in("tipo", ["cuota10", "clase"]).gte("created_at", inicioMes.toISOString());
  if ((premiosMes ?? 0) >= TOPE_PREMIOS_MES) {
    try { await avisoAdmin(`Posible abuso de referidos — ${nombreMadrina || emailMadrina}`, `<h2 style="color:#7d2b13;margin:0 0 8px;">Revisar referidos</h2><p><strong>${nombreMadrina || emailMadrina}</strong> (código ${codigo}) ha superado ${TOPE_PREMIOS_MES} premios este mes. No se ha aplicado el premio de esta amiga; revísalo por si acaso.</p>`); } catch (e) { console.error("aviso abuso:", e); }
    return;
  }

  const customerId = await customerDeMensualidad(emailMadrina);
  if (customerId) {
    const txn = await stripe.customers.createBalanceTransaction(customerId, {
      amount: -DESCUENTO_CUOTA_CENT, currency: "eur",
      description: `Trae a tu amiga · madrina · código ${codigo}`,
    });
    await registrarPremio(codigo, emailMadrina, "cuota10", "10€ en su cuota", DESCUENTO_CUOTA_CENT, customerId, txn.id, null, amigaEmail);
    try { await enviarEmailPremioMadrina(emailMadrina, nombreMadrina, "10€ de descuento en tu próxima cuota"); } catch (e) { console.error("email premio madrina:", e); }
  } else {
    const disc = await disciplinaBonoDe(emailMadrina);
    const bonoId = await crearBonoRegalo(emailMadrina, nombreMadrina, disc, validoDesdeHoy());
    await registrarPremio(codigo, emailMadrina, "clase", "+1 clase", null, null, null, bonoId, amigaEmail);
    try { await enviarEmailPremioMadrina(emailMadrina, nombreMadrina, "1 clase de regalo"); } catch (e) { console.error("email premio madrina:", e); }
  }

  // ¿Ha llegado a Embajadora (5 amigas)? Avisa a Andrea una sola vez para el mes gratis.
  try {
    if (await contarAmigas(codigo) >= AMIGAS_EMBAJADORA) {
      const { count: yaAviso } = await supabaseAdmin
        .from("premios_referido").select("id", { count: "exact", head: true })
        .eq("madrina_codigo", codigo).eq("tipo", "aviso_embajadora");
      if (!(yaAviso ?? 0)) {
        await registrarPremio(codigo, emailMadrina, "aviso_embajadora", "5 amigas", null, null, null, null, null);
        await avisoAdmin(`Nueva Embajadora — ${nombreMadrina || emailMadrina}`, `<h2 style="color:#b8860b;margin:0 0 8px;">👑 Nueva Embajadora</h2><p><strong>${nombreMadrina || emailMadrina}</strong> (código ${codigo}) ha llegado a <strong>5 amigas</strong>. Otórgale su <strong>1 mes gratis</strong> desde Admin → Referidos.</p>`);
      }
    }
  } catch (e) { console.error("aviso embajadora:", e); }
}

// La amiga entra con un BONO 5/12 → +1 clase; y se premia a la madrina según su tipo.
export async function premiarReferidoBono(codigo: string, amigaEmail: string, amigaNombre: string, disciplina: string, validoDesde: string) {
  await crearBonoRegalo(amigaEmail, amigaNombre, disciplina, validoDesde);
  await premiarMadrina(codigo, amigaEmail);
}

// Descuento de 10€ en la cuota de la AMIGA que entra por mensualidad. Debe aplicarse
// ANTES de crear la suscripción para que el crédito caiga en su PRIMERA factura (si se
// aplicara después de crear la suscripción, y el alta es posterior al 1-sep sin periodo
// de prueba, la primera cuota ya se habría cobrado y el crédito iría a la segunda).
export async function descuentoCuotaAmiga(amigaCustomerId: string | null, codigo: string) {
  if (!amigaCustomerId) return;
  await stripe.customers.createBalanceTransaction(amigaCustomerId, {
    amount: -DESCUENTO_CUOTA_CENT, currency: "eur",
    description: `Trae a tu amiga · amiga · código ${codigo}`,
  });
}

// Aviso a la madrina de que su amiga se apuntó y ya tiene su premio.
async function enviarEmailPremioMadrina(email: string, nombreMadrina: string, premioTexto: string) {
  const from = process.env.FROM_EMAIL ?? "onboarding@resend.dev";
  const invita = enlaceInvita(email);
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#f5ede8;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5ede8;padding:40px 16px;"><tr><td align="center">
    <table width="100%" style="max-width:520px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 8px 40px rgba(37,25,15,0.10);">
      <tr><td style="padding:34px 40px 8px;text-align:center;">
        <h1 style="margin:0 0 12px;font-size:24px;font-weight:600;color:#25190f;font-family:Georgia,serif;">¡Gracias por invitar${nombreMadrina ? `, ${nombreMadrina}` : ""}! 🤎</h1>
        <p style="margin:0;font-size:15px;color:#56423d;line-height:1.7;">Una amiga se ha apuntado con tu código, así que ya tienes <strong>${premioTexto}</strong>. ¿Invitas a otra? Cada amiga que traiga su bono o mensualidad os da un regalo a las dos.</p>
      </td></tr>
      <tr><td style="padding:20px 32px 36px;text-align:center;">
        <a href="${invita}" style="display:inline-block;background:#7d2b13;color:#fff8f5;text-decoration:none;font-size:14px;font-weight:700;padding:15px 40px;border-radius:9999px;">Ver y compartir mi código →</a>
      </td></tr>
      <tr><td style="background:#fff8f5;border-top:1px solid #f0ddd5;padding:24px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#25190f;">Andrea Carrió Studio</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
  await resend.emails.send({ from, to: email, subject: `¡Una amiga se ha apuntado con tu código! 🤎`, html });
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

// HTML del correo del bono, exportado para poder previsualizarlo en el admin
// (es exactamente el mismo HTML que se envía). Lo usa enviarEmailBono más abajo.
export function buildBonoEmailHtml(m: Record<string, string>, creditos: number, caduca: Date, validoDesde: string, esReferida = false): string {
  const disc = DISC_LABEL[m.disciplina_id] ?? m.disciplina_id;
  const caducaStr = caduca.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  // Siempre al login (entrar=1) → cada persona entra en SU panel, no con una sesión previa.
  const panel = `${APP_URL}/mis-clases?entrar=1&email=${encodeURIComponent(m.email)}`;
  const creditosTxt = creditos === 1 ? "1 clase" : `${creditos} clases`;
  const porEmpezar = !!validoDesde && validoDesde > new Date().toISOString().slice(0, 10);
  const inicioStr = validoDesde ? new Date(`${validoDesde}T00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long" }) : "";

  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/></head>
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
      <tr><td style="padding:16px 32px 24px;text-align:center;">
        <a href="${panel}" style="display:inline-block;background:#7d2b13;color:#fff8f5;text-decoration:none;font-size:14px;font-weight:700;letter-spacing:.5px;padding:15px 40px;border-radius:9999px;">Reservar mis clases →</a>
      </td></tr>
      <tr><td style="padding:0 32px 32px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff6f2;border:1px solid #7d2b13;border-radius:16px;"><tr><td style="padding:18px 22px;text-align:center;">
          <p style="margin:0 0 6px;font-size:14px;font-weight:700;color:#7d2b13;">Invita a una amiga y ganáis las dos 🤎</p>
          <p style="margin:0 0 14px;font-size:13px;color:#56423d;line-height:1.6;">Cuando saque su bono o mensualidad con tu código, tú y ella os lleváis un regalo.</p>
          <a href="${enlaceInvita(m.email)}" style="display:inline-block;background:#7d2b13;color:#fff8f5;text-decoration:none;font-size:13px;font-weight:700;padding:13px 32px;border-radius:9999px;">Ver y compartir mi código →</a>
        </td></tr></table>
      </td></tr>
      <tr><td style="background:#fff8f5;border-top:1px solid #f0ddd5;padding:24px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#25190f;">Andrea Carrió Studio</p>
        <p style="margin:5px 0 0;font-size:11px;color:#89726c;">C/ Motilla del Palancar 34, Alfahuir (Valencia)</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;
}

// Envía el correo del bono a la clienta (mismo HTML exacto que el preview del admin).
async function enviarEmailBono(m: Record<string, string>, creditos: number, caduca: Date, validoDesde: string, esReferida = false) {
  if (!m.email) return;
  const from = process.env.FROM_EMAIL ?? "onboarding@resend.dev";
  const disc = DISC_LABEL[m.disciplina_id] ?? m.disciplina_id;
  await resend.emails.send({
    from,
    to: m.email,
    subject: `Tu ${m.nombre ?? "bono"} de ${disc} ya está activo 🤎`,
    html: buildBonoEmailHtml(m, creditos, caduca, validoDesde, esReferida),
  });
}
