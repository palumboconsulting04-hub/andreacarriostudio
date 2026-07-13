import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { stripe } from "@/lib/stripe";
import { crearBonoRegalo, BONO_INICIO_CURSO } from "@/lib/bonos-server";

async function isAdmin(): Promise<boolean> {
  const session = (await cookies()).get("admin_session");
  return !!session && session.value === process.env.ADMIN_SESSION_SECRET;
}

const CREDITO_CUOTA_CENT = 1500; // 15€ por amiga de mensualidad

// Otorga (a mano, desde el admin) un premio del programa "Trae a tu amiga":
//  - clase      → +1 clase de regalo (madrina de bono)
//  - cuota15    → 15€ de crédito en la próxima cuota (madrina de mensualidad)
//  - mes_gratis → un mes de cuota gratis (Embajadora, madrina de mensualidad)
// El crédito de cuota se aplica como saldo del cliente en Stripe (suma y es
// reversible). Cada premio queda registrado en premios_referido para no repetirlo.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { codigo?: string; tipo?: string } | null;
  const codigo = (body?.codigo ?? "").trim().toUpperCase();
  const tipo = (body?.tipo ?? "").trim();
  if (!codigo || !["clase", "cuota15", "mes_gratis"].includes(tipo)) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  // Madrina.
  const { data: mad } = await supabaseAdmin
    .from("referidos_codigo").select("codigo, email, nombre").eq("codigo", codigo).maybeSingle();
  if (!mad) return NextResponse.json({ error: "Código no encontrado" }, { status: 404 });
  const madrinaEmail = (mad.email ?? "").toLowerCase();
  const madrinaNombre = mad.nombre ?? "";

  // Contexto: cuántas amigas de mensualidad trajo y qué premios ya tiene.
  const [amigasBonoRes, amigasIscrRes, premiosRes] = await Promise.all([
    supabaseAdmin.from("bonos").select("email").eq("referido_por", codigo),
    supabaseAdmin.from("iscrizioni").select("email").eq("referido_por", codigo),
    supabaseAdmin.from("premios_referido").select("tipo").eq("madrina_codigo", codigo),
  ]);
  const emailsMensualidad = new Set((amigasIscrRes.data ?? []).map((r) => (r.email ?? "").toLowerCase()).filter(Boolean));
  const emailsBono = new Set((amigasBonoRes.data ?? []).map((r) => (r.email ?? "").toLowerCase()).filter(Boolean));
  const totalAmigas = new Set([...emailsMensualidad, ...emailsBono]).size;
  const premios = premiosRes.data ?? [];
  const otorgadosPorAmiga = premios.filter((p) => p.tipo === "clase" || p.tipo === "cuota15").length;
  const otorgadosMes = premios.filter((p) => p.tipo === "mes_gratis").length;

  // Topes: no otorgar más de lo ganado.
  if (tipo === "clase" || tipo === "cuota15") {
    if (otorgadosPorAmiga >= emailsMensualidad.size) {
      return NextResponse.json({ error: "No hay premios por amiga de mensualidad pendientes." }, { status: 409 });
    }
  } else if (tipo === "mes_gratis") {
    if (totalAmigas < 3) return NextResponse.json({ error: "Aún no llega a 3 amigas (Embajadora)." }, { status: 409 });
    if (otorgadosMes >= 1) return NextResponse.json({ error: "El mes gratis ya se otorgó." }, { status: 409 });
  }

  // Suscripción/cliente de la madrina (si paga mensualidad).
  const { data: isc } = await supabaseAdmin
    .from("iscrizioni")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("email", madrinaEmail)
    .not("stripe_customer_id", "is", null)
    .limit(1)
    .maybeSingle();
  const customerId = isc?.stripe_customer_id ?? null;
  const subId = isc?.stripe_subscription_id ?? null;

  try {
    if (tipo === "clase") {
      // Disciplina: la del último bono de la madrina, o Barre por defecto.
      const { data: bono } = await supabaseAdmin
        .from("bonos").select("disciplina_id").eq("email", madrinaEmail).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const disciplina = bono?.disciplina_id ?? "barre-fit";
      const hoy = new Date().toISOString().slice(0, 10);
      const validoDesde = hoy < BONO_INICIO_CURSO ? BONO_INICIO_CURSO : hoy;
      const bonoId = await crearBonoRegalo(madrinaEmail, madrinaNombre, disciplina, validoDesde);
      await registrar(codigo, madrinaEmail, "clase", "+1 clase de regalo", null, null, null, bonoId);
      return NextResponse.json({ ok: true, detalle: "+1 clase de regalo añadida a su panel." });
    }

    // Premios de cuota: requieren cliente de Stripe (mensualidad).
    if (!customerId) {
      return NextResponse.json({ error: "Esta madrina no paga mensualidad; dale el premio en clases (+1 clase)." }, { status: 409 });
    }

    let importeCent = CREDITO_CUOTA_CENT;
    let detalle = "15€ de crédito en su próxima cuota";
    if (tipo === "mes_gratis") {
      importeCent = await importeMensual(subId);
      detalle = "1 mes gratis (crédito de una cuota)";
    }

    // Crédito en el saldo del cliente: negativo = descuento en la próxima factura.
    const txn = await stripe.customers.createBalanceTransaction(customerId, {
      amount: -importeCent,
      currency: "eur",
      description: `Trae a tu amiga · ${detalle} · código ${codigo}`,
    });
    await registrar(codigo, madrinaEmail, tipo, detalle, importeCent, customerId, txn.id, null);
    return NextResponse.json({ ok: true, detalle: `${detalle} (${(importeCent / 100).toFixed(2)}€) aplicado en Stripe.` });
  } catch (e) {
    console.error("otorgar premio:", e);
    return NextResponse.json({ error: "No se pudo aplicar el premio." }, { status: 500 });
  }
}

// Suma el importe recurrente mensual de la suscripción (en céntimos).
async function importeMensual(subId: string | null): Promise<number> {
  if (!subId) return CREDITO_CUOTA_CENT;
  const sub = await stripe.subscriptions.retrieve(subId);
  let total = 0;
  for (const it of sub.items?.data ?? []) {
    const unit = it.price?.unit_amount ?? 0;
    total += unit * (it.quantity ?? 1);
  }
  return total > 0 ? total : CREDITO_CUOTA_CENT;
}

async function registrar(
  codigo: string, email: string, tipo: string, detalle: string,
  importeCent: number | null, customerId: string | null, txnId: string | null, bonoId: string | null,
) {
  await supabaseAdmin.from("premios_referido").insert({
    madrina_codigo: codigo,
    madrina_email: email,
    tipo,
    detalle,
    importe_cent: importeCent,
    stripe_customer_id: customerId,
    stripe_balance_txn_id: txnId,
    bono_id: bonoId,
  });
}
