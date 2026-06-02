import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function isAdmin(): Promise<boolean> {
  const session = (await cookies()).get("admin_session");
  return !!session && session.value === process.env.ADMIN_SESSION_SECRET;
}

// Cancela la suscripción del bono de una inscripción (cuando la madre se da de baja).
// Cancela en Stripe y marca como 'cancelada' en la base de datos.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { iscrizioneId } = (await req.json()) as { iscrizioneId?: string };
  if (!iscrizioneId) {
    return NextResponse.json({ error: "Falta iscrizioneId" }, { status: 400 });
  }

  const { data: row, error } = await supabaseAdmin
    .from("iscrizioni")
    .select("stripe_subscription_id")
    .eq("id", iscrizioneId)
    .single();
  if (error || !row) {
    return NextResponse.json({ error: "Inscripción no encontrada" }, { status: 404 });
  }
  if (!row.stripe_subscription_id) {
    return NextResponse.json({ error: "Esta inscripción no tiene suscripción activa" }, { status: 400 });
  }

  try {
    await stripe.subscriptions.cancel(row.stripe_subscription_id);
  } catch (e) {
    // Si ya estaba cancelada en Stripe, seguimos y solo actualizamos la BD.
    console.error("cancel-subscription Stripe error:", e);
  }

  // Marca como cancelada todas las inscripciones de esa suscripción.
  await supabaseAdmin
    .from("iscrizioni")
    .update({ stato: "cancelada" })
    .eq("stripe_subscription_id", row.stripe_subscription_id);

  return NextResponse.json({ ok: true });
}
