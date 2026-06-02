import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, BONO_BILLING_ANCHOR, MATRICULA_PI_TIPO } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

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
    }
  } catch (err) {
    console.error(`Webhook handler error (${event.type}):`, err);
    // Devolver 500 hace que Stripe reintente el evento más tarde.
    return NextResponse.json({ error: "handler_error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
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
    .select("id, piano_id, disciplina_id, stripe_subscription_id")
    .eq("stripe_payment_intent_id", pi.id);
  if (error) throw error;
  if (!rows || rows.length === 0) {
    console.error("crearSuscripcion: sin inscripciones para PI", pi.id);
    return;
  }

  // Idempotencia: si ya tienen suscripción, no crear otra.
  if (rows.some((r) => r.stripe_subscription_id)) return;

  // Precio recurrente (Stripe) de cada plan inscrito.
  const items: { price: string }[] = [];
  for (const r of rows) {
    const { data: plan } = await supabaseAdmin
      .from("piani")
      .select("stripe_price_id")
      .eq("id", r.piano_id)
      .eq("disciplina_id", r.disciplina_id)
      .single();
    if (!plan?.stripe_price_id) {
      throw new Error(`Plan sin stripe_price_id: ${r.piano_id}/${r.disciplina_id}`);
    }
    items.push({ price: plan.stripe_price_id });
  }

  // La tarjeta queda como predeterminada del cliente y de la suscripción.
  await stripe.customers.update(customerId, {
    invoice_settings: { default_payment_method: paymentMethodId },
  });

  const sub = await stripe.subscriptions.create({
    customer: customerId,
    items,
    default_payment_method: paymentMethodId,
    // Periodo de prueba hasta el 1 de septiembre: no se cobra nada hasta entonces;
    // ese día se cobra el primer bono y luego automáticamente cada mes.
    trial_end: BONO_BILLING_ANCHOR,
    metadata: { origen: "inscripcion-bono" },
  });

  await supabaseAdmin
    .from("iscrizioni")
    .update({
      stato: "matricula_pagada",
      stripe_subscription_id: sub.id,
      stripe_customer_id: customerId,
    })
    .eq("stripe_payment_intent_id", pi.id);
}
