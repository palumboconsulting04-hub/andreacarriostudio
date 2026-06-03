import { NextRequest, NextResponse } from "next/server";
import { stripe, MATRICULA_PI_TIPO } from "@/lib/stripe";
import { findCoupon, applyCoupon } from "@/lib/coupons";

// Crea (o reutiliza) el cliente de Stripe y un PaymentIntent para cobrar la
// MATRÍCULA ahora, guardando la tarjeta para uso futuro (off-session).
//
// El cobro del bono NO se hace aquí: cuando este PaymentIntent se confirma con
// éxito, el webhook (payment_intent.succeeded con metadata.tipo = matricula-bono)
// crea la suscripción mensual con la tarjeta guardada, programada para el 1 de sept.
export async function POST(req: NextRequest) {
  try {
    const { matriculaEur, email, nombre, description, couponCode } = (await req.json()) as {
      matriculaEur: number;
      email: string;
      nombre?: string;
      description?: string;
      couponCode?: string;
    };

    const emailNorm = (email ?? "").toLowerCase().trim();
    const emailValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm);
    if (!emailValido) {
      return NextResponse.json({ error: "Email no válido" }, { status: 400 });
    }

    // El cupón solo se aplica a la matrícula (lo único que se cobra hoy).
    // Se re-valida en el servidor para que no pueda forzarse desde el navegador.
    const coupon = couponCode ? findCoupon(couponCode) : null;
    const matriculaFinal = applyCoupon(matriculaEur, coupon);

    // Reutiliza el cliente si ya existe con ese email; si no, créalo.
    const existing = await stripe.customers.list({ email: emailNorm, limit: 1 });
    const customer = existing.data[0]
      ?? (await stripe.customers.create({ email: emailNorm, name: nombre || undefined }));

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(matriculaFinal * 100),
      currency: "eur",
      customer: customer.id,
      // Sin receipt_email: la confirmación la envía la web (Resend); así Stripe
      // no manda además su propio recibo automático al cliente.
      description: description || "Matrícula — Andrea Carrió Studio",
      // Guarda la tarjeta para poder cobrar el bono automáticamente en septiembre.
      setup_future_usage: "off_session",
      automatic_payment_methods: { enabled: true },
      metadata: { tipo: MATRICULA_PI_TIPO },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      customerId: customer.id,
    });
  } catch (err) {
    console.error("create-subscription error:", err);
    return NextResponse.json({ error: "No se pudo iniciar el pago" }, { status: 500 });
  }
}
