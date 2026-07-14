import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { stripe } from "@/lib/stripe";

async function isAdmin(): Promise<boolean> {
  const session = (await cookies()).get("admin_session");
  return !!session && session.value === process.env.ADMIN_SESSION_SECRET;
}

const AMIGAS_EMBAJADORA = 5; // 5 amigas → 1 mes gratis

// Único premio a mano: el MES GRATIS de Embajadora (5 amigas). El resto de premios
// (10€ en cuota / 1 clase por cada amiga) son automáticos. El mes gratis se aplica
// como saldo del cliente en Stripe (reversible) y queda registrado en premios_referido.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { codigo?: string; tipo?: string } | null;
  const codigo = (body?.codigo ?? "").trim().toUpperCase();
  const tipo = (body?.tipo ?? "").trim();
  if (!codigo || tipo !== "mes_gratis") {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  // Madrina.
  const { data: mad } = await supabaseAdmin
    .from("referidos_codigo").select("email").eq("codigo", codigo).maybeSingle();
  if (!mad) return NextResponse.json({ error: "Código no encontrado" }, { status: 404 });
  const madrinaEmail = (mad.email ?? "").toLowerCase();

  // Contexto: cuántas amigas distintas trajo y si ya se le dio el mes gratis.
  const [amigasBonoRes, amigasIscrRes, premiosRes] = await Promise.all([
    supabaseAdmin.from("bonos").select("email").eq("referido_por", codigo),
    supabaseAdmin.from("iscrizioni").select("email").eq("referido_por", codigo),
    supabaseAdmin.from("premios_referido").select("tipo").eq("madrina_codigo", codigo),
  ]);
  const totalAmigas = new Set([
    ...(amigasBonoRes.data ?? []).map((r) => (r.email ?? "").toLowerCase()),
    ...(amigasIscrRes.data ?? []).map((r) => (r.email ?? "").toLowerCase()),
  ].filter(Boolean)).size;
  const yaTieneMes = (premiosRes.data ?? []).some((p) => p.tipo === "mes_gratis");

  if (totalAmigas < AMIGAS_EMBAJADORA) {
    return NextResponse.json({ error: `Aún no llega a ${AMIGAS_EMBAJADORA} amigas (Embajadora).` }, { status: 409 });
  }
  if (yaTieneMes) return NextResponse.json({ error: "El mes gratis ya se otorgó." }, { status: 409 });

  // Suscripción/cliente de la madrina (el mes gratis es para madrinas de mensualidad).
  const { data: isc } = await supabaseAdmin
    .from("iscrizioni")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("email", madrinaEmail)
    .not("stripe_customer_id", "is", null)
    .limit(1)
    .maybeSingle();
  const customerId = isc?.stripe_customer_id ?? null;
  const subId = isc?.stripe_subscription_id ?? null;
  if (!customerId) {
    return NextResponse.json({ error: "Esta madrina no paga mensualidad; el mes gratis no aplica." }, { status: 409 });
  }

  try {
    const importeCent = await importeMensual(subId);
    const txn = await stripe.customers.createBalanceTransaction(customerId, {
      amount: -importeCent,
      currency: "eur",
      description: `Trae a tu amiga · 1 mes gratis (Embajadora) · código ${codigo}`,
    });
    await supabaseAdmin.from("premios_referido").insert({
      madrina_codigo: codigo,
      madrina_email: madrinaEmail,
      tipo: "mes_gratis",
      detalle: "1 mes gratis (Embajadora)",
      importe_cent: importeCent,
      stripe_customer_id: customerId,
      stripe_balance_txn_id: txn.id,
      bono_id: null,
    });
    return NextResponse.json({ ok: true, detalle: `1 mes gratis (${(importeCent / 100).toFixed(2)}€) aplicado en Stripe.` });
  } catch (e) {
    console.error("otorgar mes gratis:", e);
    return NextResponse.json({ error: "No se pudo aplicar el mes gratis." }, { status: 500 });
  }
}

// Suma el importe recurrente mensual de la suscripción (en céntimos).
async function importeMensual(subId: string | null): Promise<number> {
  if (!subId) return 6500;
  const sub = await stripe.subscriptions.retrieve(subId);
  let total = 0;
  for (const it of sub.items?.data ?? []) {
    const unit = it.price?.unit_amount ?? 0;
    total += unit * (it.quantity ?? 1);
  }
  return total > 0 ? total : 6500;
}
