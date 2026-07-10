import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { emailDeSesion } from "@/lib/panel-auth";

const DL: Record<string, string> = { "barre-fit": "Barre Fit", "pilates-mat": "Pilates Mat" };

// Sesión de pago EMBEBIDA (Embedded Checkout) para comprar un bono desde el panel,
// sin salir de la página. La alumna ya está logueada → usamos su email/nombre.
export async function POST(req: NextRequest) {
  const email = await emailDeSesion();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const bonoTipoId = (body?.bono_tipo_id ?? "").toString();
  if (!bonoTipoId) return NextResponse.json({ error: "Falta el bono" }, { status: 400 });

  const { data: tipo } = await supabaseAdmin
    .from("bonos_tipo").select("id, disciplina_id, nombre, creditos, precio, validez_meses, activo")
    .eq("id", bonoTipoId).single();
  if (!tipo || !tipo.activo) return NextResponse.json({ error: "Ese bono no está disponible" }, { status: 400 });

  // Nombre/teléfono de la alumna desde un bono suyo existente.
  const { data: bono } = await supabaseAdmin
    .from("bonos").select("nombre, telefono").ilike("email", email)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    ui_mode: "embedded_page",
    redirect_on_completion: "never",
    customer_email: email,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: Math.round(Number(tipo.precio) * 100),
        product_data: { name: `${tipo.nombre} · ${DL[tipo.disciplina_id] ?? tipo.disciplina_id}` },
      },
    }],
    metadata: {
      tipo: "compra-bono",
      bono_tipo_id: tipo.id,
      disciplina_id: tipo.disciplina_id,
      nombre: bono?.nombre ?? "",
      email,
      telefono: bono?.telefono ?? "",
      creditos: String(tipo.creditos),
      validez_meses: String(tipo.validez_meses),
      precio: String(tipo.precio),
    },
  });

  return NextResponse.json({ client_secret: session.client_secret, session_id: session.id });
}
