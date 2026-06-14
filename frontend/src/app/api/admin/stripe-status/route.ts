import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function isAdmin(): Promise<boolean> {
  const session = (await cookies()).get("admin_session");
  return !!session && session.value === process.env.ADMIN_SESSION_SECRET;
}

// Estado REAL en Stripe de una inscripción (solo lectura). Permite a Andrea ver,
// sin entrar en Stripe, si la matrícula se cobró y cuándo empieza/va el bono.
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const id = req.nextUrl.searchParams.get("iscrizioneId");
  if (!id) {
    return NextResponse.json({ error: "Falta iscrizioneId" }, { status: 400 });
  }

  const { data: row, error } = await supabaseAdmin
    .from("iscrizioni")
    .select("stripe_payment_intent_id, stripe_subscription_id")
    .eq("id", id)
    .single();
  if (error || !row) {
    return NextResponse.json({ error: "Inscripción no encontrada" }, { status: 404 });
  }

  const out: {
    matricula: { status: string; amount: number; currency: string; date: number } | null;
    bono: {
      status: string;
      amount: number | null;
      currency: string | null;
      interval: string | null;
      nextCharge: number | null;
      cancelAtPeriodEnd: boolean;
    } | null;
    error?: string;
  } = { matricula: null, bono: null };

  try {
    if (row.stripe_payment_intent_id) {
      const pi = await stripe.paymentIntents.retrieve(row.stripe_payment_intent_id);
      out.matricula = {
        status: pi.status,
        amount: pi.amount / 100,
        currency: pi.currency.toUpperCase(),
        date: pi.created,
      };
    }
    if (row.stripe_subscription_id) {
      const sub = await stripe.subscriptions.retrieve(row.stripe_subscription_id);
      const item = sub.items?.data?.[0];
      // current_period_end vive en el item en versiones recientes de la API.
      const itemPeriodEnd = (item as unknown as { current_period_end?: number })?.current_period_end;
      const subPeriodEnd = (sub as unknown as { current_period_end?: number }).current_period_end;
      const nextCharge =
        sub.status === "trialing" ? sub.trial_end : (itemPeriodEnd ?? subPeriodEnd ?? null);
      out.bono = {
        status: sub.status,
        amount: item?.price.unit_amount != null ? item.price.unit_amount / 100 : null,
        currency: item?.price.currency?.toUpperCase() ?? null,
        interval: item?.price.recurring?.interval ?? null,
        nextCharge: nextCharge ?? null,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      };
    }
  } catch (e) {
    out.error = e instanceof Error ? e.message : "Error consultando Stripe";
  }

  return NextResponse.json({ data: out });
}
