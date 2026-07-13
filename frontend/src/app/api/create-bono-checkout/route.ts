import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";

const DISCIPLINA_LABEL: Record<string, string> = {
  "barre-fit": "Barre Fit",
  "pilates-mat": "Pilates Mat",
};

// Crea la sesión de pago (Stripe Checkout, pago único) de un bono.
// El precio y los créditos se leen de la base — nunca del cliente.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const bonoTipoId = (body?.bono_tipo_id ?? "").toString();
    const nombre = (body?.nombre ?? "").toString().trim();
    const email = (body?.email ?? "").toString().trim().toLowerCase();
    const telefono = (body?.telefono ?? "").toString().trim();
    const ref = (body?.ref ?? "").toString().trim().toUpperCase().slice(0, 20); // código de madrina

    if (!bonoTipoId || !nombre) {
      return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
    }
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      return NextResponse.json({ error: "El email no es válido" }, { status: 400 });
    }

    const { data: tipo, error } = await supabaseAdmin
      .from("bonos_tipo")
      .select("id, disciplina_id, nombre, creditos, precio, validez_meses, activo")
      .eq("id", bonoTipoId)
      .single();
    if (error || !tipo || !tipo.activo) {
      return NextResponse.json({ error: "Ese bono no está disponible" }, { status: 400 });
    }

    const origin = req.nextUrl.origin;
    const disciplinaLabel = DISCIPLINA_LABEL[tipo.disciplina_id] ?? tipo.disciplina_id;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: Math.round(Number(tipo.precio) * 100),
            product_data: { name: `${tipo.nombre} · ${disciplinaLabel}` },
          },
        },
      ],
      metadata: {
        tipo: "compra-bono",
        bono_tipo_id: tipo.id,
        disciplina_id: tipo.disciplina_id,
        nombre,
        email,
        telefono,
        creditos: String(tipo.creditos),
        validez_meses: String(tipo.validez_meses),
        precio: String(tipo.precio),
        ref,
      },
      success_url: `${origin}/bono-gracias?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/comprar-bono?disciplina=${tipo.disciplina_id}`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    console.error("create-bono-checkout error:", e);
    return NextResponse.json({ error: "No se pudo iniciar el pago" }, { status: 500 });
  }
}
