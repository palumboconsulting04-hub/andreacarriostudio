import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function isAdmin(): Promise<boolean> {
  const session = (await cookies()).get("admin_session");
  return !!session && session.value === process.env.ADMIN_SESSION_SECRET;
}

// Borra una inscripción de forma segura: si tiene suscripción del bono en Stripe,
// la cancela primero (para que no siga cobrando), y luego borra fila + horarios.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = (await req.json()) as { id?: string };
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

  const { data: row } = await supabaseAdmin
    .from("iscrizioni")
    .select("stripe_subscription_id")
    .eq("id", id)
    .single();

  // Cancelar la suscripción del bono si existe (no bloquea el borrado si falla).
  if (row?.stripe_subscription_id) {
    try {
      await stripe.subscriptions.cancel(row.stripe_subscription_id);
    } catch (e) {
      console.error("delete-iscrizione: error cancelando suscripción:", e);
    }
  }

  await supabaseAdmin.from("iscrizione_orari").delete().eq("iscrizione_id", id);
  const { error } = await supabaseAdmin.from("iscrizioni").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
