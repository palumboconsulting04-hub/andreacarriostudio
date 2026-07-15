import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import type Stripe from "stripe";
import { stripe, BONO_BILLING_ANCHOR, MATRICULA_PI_TIPO } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { procesarBonoPagado, descuentoCuotaAmiga, premiarMadrina, esClienteNueva, revertirPremiosReferido } from "@/lib/bonos-server";
import { getCodigoReferido } from "@/lib/referidos";

const FB_PIXEL_ID = "2024231855152441";
const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

function normPhone(t: string): string {
  let d = (t || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 9) d = "34" + d;
  return d;
}

// Envía el evento Purchase a la Conversions API de Meta (servidor → Meta) cuando
// el pago de la matrícula se confirma. Comparte event_id con el Purchase del
// navegador para que Meta NO lo cuente dos veces. No rompe nada si falla o si no
// hay token configurado.
async function sendCapiPurchase(pi: Stripe.PaymentIntent, telefono: string | null) {
  const token = process.env.META_CAPI_TOKEN;
  const eventId = pi.metadata?.meta_event_id || "";
  if (!token || !eventId) return;

  const value = parseFloat(pi.metadata?.purchase_value || "0") || 0;
  const email = (pi.metadata?.email || "").toLowerCase().trim();
  const fbc = pi.metadata?.meta_fbc || "";
  const fbp = pi.metadata?.meta_fbp || "";

  const user_data: Record<string, unknown> = {};
  if (email) user_data.em = [sha256(email)];
  if (telefono) user_data.ph = [sha256(normPhone(telefono))];
  if (fbc) user_data.fbc = fbc;
  if (fbp) user_data.fbp = fbp;

  const payload = {
    data: [
      {
        event_name: "Purchase",
        event_time: Math.floor(Date.now() / 1000),
        action_source: "website",
        event_source_url: "https://andreacarriostudio.vercel.app/",
        event_id: eventId,
        user_data,
        custom_data: { value, currency: "EUR" },
      },
    ],
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${FB_PIXEL_ID}/events?access_token=${token}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
    );
    if (!res.ok) console.error("CAPI Purchase error:", await res.text());
  } catch (e) {
    console.error("CAPI Purchase fetch error:", e);
  }
}

// Estados de una inscripción en el modelo de suscripción:
//   attesa            → creada, matrícula aún no pagada
//   matricula_pagada  → matrícula cobrada; bono programado (empieza 1 sept)
//   activa            → el bono ya se está cobrando cada mes
//   impago            → un cobro del bono ha fallado
//   cancelada         → suscripción dada de baja
// (Se mantiene "pagado" para el flujo antiguo de pago único, por compatibilidad.)

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        if (pi.metadata?.tipo === MATRICULA_PI_TIPO) {
          await crearSuscripcionTrasMatricula(pi);
        } else {
          // Flujo antiguo de pago único: marcar como pagado.
          await supabaseAdmin
            .from("iscrizioni")
            .update({ stato: "pagado" })
            .eq("stripe_payment_intent_id", pi.id);
        }
        break;
      }

      case "invoice.paid": {
        const inv = event.data.object as Stripe.Invoice & { subscription?: string };
        if (inv.subscription && inv.billing_reason === "subscription_cycle") {
          // Cobro mensual del bono con éxito → activa.
          await supabaseAdmin
            .from("iscrizioni")
            .update({ stato: "activa" })
            .eq("stripe_subscription_id", inv.subscription);
        }
        // Registrar la cuota cobrada como ingreso (hoja del asesor). Idempotente por
        // stripe_id (el webhook puede reintentar). No bloquea si falla.
        if (inv.subscription && (inv.amount_paid ?? 0) > 0) {
          try {
            await supabaseAdmin.from("ingresos_stripe").upsert({
              fecha: new Date((inv.created ?? Math.floor(Date.now() / 1000)) * 1000).toISOString().slice(0, 10),
              importe: (inv.amount_paid ?? 0) / 100,
              concepto: "Cuota mensualidad",
              email: inv.customer_email ?? null,
              nombre: inv.customer_name ?? null,
              metodo: "tarjeta",
              stripe_id: inv.id ?? null,
            }, { onConflict: "stripe_id", ignoreDuplicates: true });
          } catch (e) { console.error("registrar ingreso cuota Stripe:", e); }
        }
        break;
      }

      case "invoice.payment_failed": {
        const inv = event.data.object as Stripe.Invoice & { subscription?: string };
        if (inv.subscription) {
          await supabaseAdmin
            .from("iscrizioni")
            .update({ stato: "impago" })
            .eq("stripe_subscription_id", inv.subscription);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await supabaseAdmin
          .from("iscrizioni")
          .update({ stato: "cancelada" })
          .eq("stripe_subscription_id", sub.id);
        break;
      }

      case "checkout.session.completed": {
        await procesarBonoPagado(event.data.object as Stripe.Checkout.Session);
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const piId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
        if (piId) await anularBonoReembolsado(piId);
        break;
      }
    }
  } catch (err) {
    console.error(`Webhook handler error (${event.type}):`, err);
    // Devolver 500 hace que Stripe reintente el evento más tarde.
    return NextResponse.json({ error: "handler_error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// Reembolso en Stripe → anula el bono correspondiente: créditos a 0, estado
// "reembolsado" y elimina sus reservas, para que no siga usable tras devolver el
// dinero. Solo afecta a bonos (los pagos de matrícula no coinciden y se ignoran).
async function anularBonoReembolsado(paymentIntentId: string) {
  const { data: bono } = await supabaseAdmin
    .from("bonos")
    .select("id, estado, email, referido_por")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();
  if (!bono || bono.estado === "reembolsado") return;
  await supabaseAdmin.from("reservas_clase").delete().eq("bono_id", bono.id);
  await supabaseAdmin.from("bonos").update({ creditos_restantes: 0, estado: "reembolsado" }).eq("id", bono.id);
  // Si esta compra vino de un referido, revierte el premio que se dio a la madrina.
  if (bono.referido_por && bono.email) {
    try { await revertirPremiosReferido(bono.email); } catch (e) { console.error("reverso premios referido:", e); }
  }
}

// Crea la suscripción mensual del bono con la tarjeta guardada en el pago de la
// matrícula. Las inscripciones se localizan por el id del PaymentIntent.
async function crearSuscripcionTrasMatricula(pi: Stripe.PaymentIntent) {
  const customerId = typeof pi.customer === "string" ? pi.customer : pi.customer?.id;
  const paymentMethodId =
    typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method?.id;
  if (!customerId || !paymentMethodId) {
    console.error("crearSuscripcion: falta customer o payment_method en", pi.id);
    return;
  }

  // Inscripciones de este pago.
  const { data: rows, error } = await supabaseAdmin
    .from("iscrizioni")
    .select("id, piano_id, disciplina_id, stripe_subscription_id, telefono, email, nome, referido_por")
    .eq("stripe_payment_intent_id", pi.id);
  if (error) throw error;
  if (!rows || rows.length === 0) {
    console.error("crearSuscripcion: sin inscripciones para PI", pi.id);
    return;
  }

  // Idempotencia: si ya tienen suscripción, no crear otra.
  if (rows.some((r) => r.stripe_subscription_id)) return;

  // Precio recurrente (Stripe) de cada plan inscrito + su cuota en € (para poder
  // cobrar el mes en curso, entero o a mitad, en altas a mitad de curso).
  const items: { price: string }[] = [];
  let cuotaCent = 0;
  for (const r of rows) {
    const { data: plan } = await supabaseAdmin
      .from("piani")
      .select("stripe_price_id, prezzo")
      .eq("id", r.piano_id)
      .eq("disciplina_id", r.disciplina_id)
      .single();
    if (!plan?.stripe_price_id) {
      throw new Error(`Plan sin stripe_price_id: ${r.piano_id}/${r.disciplina_id}`);
    }
    items.push({ price: plan.stripe_price_id });
    cuotaCent += Math.round((plan.prezzo ?? 0) * 100);
  }

  // La tarjeta queda como predeterminada del cliente y de la suscripción.
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });

  // Regla: el bono empieza SIEMPRE el 1 de septiembre, sin importar cuándo se
  // apunte la madre. Mientras esa fecha esté en el futuro, se usa como fin del
  // periodo de prueba (no se cobra nada hasta entonces). Si el curso ya ha
  // empezado (alta después del 1 de sept), el bono se cobra desde ese momento.
  const ahora = Math.floor(Date.now() / 1000);
  const subParams: Stripe.SubscriptionCreateParams = {
    customer: customerId,
    items,
    default_payment_method: paymentMethodId,
    metadata: { origen: "inscripcion-bono" },
  };
  // Cobro del mes EN CURSO para altas a mitad de curso (después del 1-sep). Se cobra
  // aparte ahora: MEDIA cuota si se apunta el día 15 o después (solo verá ~15 días),
  // si no, cuota entera. Las cuotas llenas siguientes caen el día 1 de cada mes.
  let cobrarParcialCent = 0;
  let parcialDesc = "";
  if (BONO_BILLING_ANCHOR > ahora + 3600) {
    // Antes del 1-sep: prueba hasta el 1-sep; la primera cuota LLENA cae el 1-sep.
    subParams.trial_end = BONO_BILLING_ANCHOR;
  } else {
    // Alta a mitad de curso: prueba hasta el día 1 del mes siguiente (para que las
    // cuotas llenas caigan el día 1) y el mes en curso se cobra ahora.
    const madridNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Madrid" }));
    const dia = madridNow.getDate();
    const primeroSiguiente = new Date(madridNow.getFullYear(), madridNow.getMonth() + 1, 1);
    subParams.trial_end = Math.floor(primeroSiguiente.getTime() / 1000);
    if (cuotaCent > 0) {
      const mitad = dia >= 15;
      cobrarParcialCent = mitad ? Math.round(cuotaCent / 2) : cuotaCent;
      parcialDesc = mitad
        ? "Media cuota del mes en curso (alta a partir del día 15) — Andrea Carrió Studio"
        : "Cuota del mes en curso — Andrea Carrió Studio";
    }
  }

  // Trae a tu amiga: el descuento de 10€ de la AMIGA se aplica ANTES de crear la
  // suscripción, para que el crédito caiga en su PRIMERA cuota (si el alta es posterior
  // al 1-sep, la primera factura se cobra al crear la suscripción). Solo si la amiga es
  // NUEVA (sin compras previas). No bloquea si falla.
  const referidoPor = rows.find((r) => r.referido_por)?.referido_por ?? null;
  const amigaEmail = rows[0]?.email ?? "";
  const amigaNueva = referidoPor ? await esClienteNueva(amigaEmail, { excluirPi: pi.id }).catch(() => false) : false;
  if (referidoPor && amigaNueva) {
    try { await descuentoCuotaAmiga(customerId, referidoPor); }
    catch (e) { console.error("descuento amiga referido:", e); }
  }

  const sub = await stripe.subscriptions.create(subParams);

  await supabaseAdmin
    .from("iscrizioni")
    .update({
      stato: "matricula_pagada",
      stripe_subscription_id: sub.id,
      stripe_customer_id: customerId,
    })
    .eq("stripe_payment_intent_id", pi.id);

  // Cobra el mes en curso (media o entera) en altas a mitad de curso. Con la tarjeta
  // ya guardada (off-session). No bloquea el alta si falla; queda el error en el log.
  if (cobrarParcialCent > 0) {
    try {
      const piParcial = await stripe.paymentIntents.create({
        amount: cobrarParcialCent,
        currency: "eur",
        customer: customerId,
        payment_method: paymentMethodId,
        off_session: true,
        confirm: true,
        description: parcialDesc,
        metadata: { tipo: "cuota-mes-en-curso", email: rows[0]?.email ?? "" },
      });
      // Registrar el cobro del mes en curso como ingreso (hoja del asesor).
      try {
        await supabaseAdmin.from("ingresos_stripe").upsert({
          fecha: new Date().toISOString().slice(0, 10),
          importe: cobrarParcialCent / 100,
          concepto: parcialDesc.startsWith("Media") ? "Media cuota (mes en curso)" : "Cuota (mes en curso)",
          email: rows[0]?.email ?? null,
          nombre: rows[0]?.nome ?? null,
          metodo: "tarjeta",
          stripe_id: piParcial.id,
        }, { onConflict: "stripe_id", ignoreDuplicates: true });
      } catch (e) { console.error("registrar ingreso parcial:", e); }
    } catch (e) {
      console.error("cobro mes en curso (parcial) falló:", e);
    }
  }

  // Premio de la MADRINA (según su tipo). Va después: no depende del orden de la cuota.
  if (referidoPor && amigaNueva) {
    try { await premiarMadrina(referidoPor, amigaEmail); }
    catch (e) { console.error("premio madrina referido:", e); }
  }

  // Genera el código de referido de la nueva alumna, para que ella también pueda
  // invitar a amigas (antes solo se generaba a las de bono). No bloquea si falla.
  try { await getCodigoReferido(rows[0]?.email ?? "", rows[0]?.nome ?? ""); }
  catch (e) { console.error("codigo referido mensualidad:", e); }

  // Conversión Purchase a Meta por servidor (CAPI). No bloquea si falla.
  await sendCapiPurchase(pi, rows[0]?.telefono ?? null);
}
