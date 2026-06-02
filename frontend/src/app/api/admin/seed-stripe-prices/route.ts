import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Crea en Stripe un precio recurrente mensual por cada plan (piani) y guarda su id
// en piani.stripe_price_id. Es idempotente: salta los planes que ya tienen precio.
// Ejecutar UNA vez (por entorno: test y luego live) con: POST /api/admin/seed-stripe-prices
async function isAdmin(): Promise<boolean> {
  const session = (await cookies()).get("admin_session");
  return !!session && session.value === process.env.ADMIN_SESSION_SECRET;
}

async function getBonoProductId(): Promise<string> {
  const { data } = await supabaseAdmin
    .from("stripe_config")
    .select("value")
    .eq("key", "bono_product_id")
    .maybeSingle();
  if (data?.value) return data.value;

  const product = await stripe.products.create({
    name: "Cuota mensual — Andrea Carrió Studio",
  });
  await supabaseAdmin
    .from("stripe_config")
    .upsert({ key: "bono_product_id", value: product.id, updated_at: new Date().toISOString() });
  return product.id;
}

export async function POST() {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const productId = await getBonoProductId();

  const { data: planes, error } = await supabaseAdmin
    .from("piani")
    .select("id, disciplina_id, nome, prezzo, stripe_price_id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const creados: { plan: string; disciplina: string; price_id: string }[] = [];
  const saltados: string[] = [];

  for (const p of planes ?? []) {
    if (p.stripe_price_id) {
      saltados.push(`${p.disciplina_id}/${p.id}`);
      continue;
    }
    const price = await stripe.prices.create({
      product: productId,
      currency: "eur",
      unit_amount: Math.round(Number(p.prezzo) * 100),
      recurring: { interval: "month" },
      nickname: `${p.nome} — ${p.disciplina_id}`,
    });
    await supabaseAdmin
      .from("piani")
      .update({ stripe_price_id: price.id })
      .eq("id", p.id)
      .eq("disciplina_id", p.disciplina_id);
    creados.push({ plan: p.id, disciplina: p.disciplina_id, price_id: price.id });
  }

  return NextResponse.json({ ok: true, productId, creados, saltados });
}
