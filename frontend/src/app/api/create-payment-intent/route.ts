import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { findCoupon, applyCoupon } from "@/lib/coupons";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { amountEur, description, couponCode } = (await req.json()) as {
      amountEur: number;
      email?: string;
      description?: string;
      couponCode?: string;
    };

    // Re-validate the coupon server-side: the discount is only applied if the
    // code matches, so it can't be forced from the browser.
    const coupon = couponCode ? findCoupon(couponCode) : null;
    const finalAmount = applyCoupon(amountEur, coupon);

    // Sin receipt_email: la confirmación la envía la web (Resend); así Stripe
    // no manda además su propio recibo automático al cliente.
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(finalAmount * 100),
      currency: "eur",
      description: description || "Inscripción Andrea Carrió Studio",
      automatic_payment_methods: { enabled: true },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error("create-payment-intent error:", err);
    return NextResponse.json({ error: "No se pudo crear el pago" }, { status: 500 });
  }
}
