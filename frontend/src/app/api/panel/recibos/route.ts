import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { emailDeSesion } from "@/lib/panel-auth";

const DISC: Record<string, string> = {
  "barre-fit": "Barre Fit", "pilates-mat": "Pilates Mat",
  "pre-ballet": "Pre-Ballet", "ballet-i": "Ballet I", "ballet-ii": "Ballet II",
};
const PAID = ["pagato", "pagado", "activa"];

export function metodoLabel(m: string | null | undefined): string {
  const M: Record<string, string> = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia", bizum: "Bizum", web: "Tarjeta (web)" };
  return M[(m ?? "").toLowerCase()] ?? "Tarjeta";
}

export type Recibo = { id: string; fecha: string; concepto: string; importe: number; metodo: string };

// GET → todos los pagos de la alumna logueada, para descargar su justificante.
// Fuentes: bonos comprados, matrícula pagada (iscrizioni) e ingresos de Stripe.
export async function GET() {
  const email = await emailDeSesion();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const e = email.toLowerCase();
  const pagos: Recibo[] = [];

  const { data: bonos } = await supabaseAdmin
    .from("bonos").select("id, disciplina_id, creditos_totales, precio_pagado, created_at").ilike("email", e);
  for (const b of bonos ?? []) {
    const imp = Number(b.precio_pagado) || 0;
    if (imp <= 0) continue;
    const disc = DISC[b.disciplina_id as string] ?? b.disciplina_id;
    pagos.push({ id: `bono_${b.id}`, fecha: (b.created_at as string).slice(0, 10), concepto: `Bono de ${b.creditos_totales} ${b.creditos_totales === 1 ? "clase" : "clases"} · ${disc}`, importe: imp, metodo: "Tarjeta" });
  }

  const { data: iscr } = await supabaseAdmin
    .from("iscrizioni").select("id, matricula, metodo_pagamento, stato, created_at").ilike("email", e);
  for (const i of iscr ?? []) {
    const mat = Number(i.matricula) || 0;
    if (mat <= 0) continue;
    if (!PAID.includes(i.stato as string) && i.stato !== "matricula_pagada") continue;
    pagos.push({ id: `matricula_${i.id}`, fecha: (i.created_at as string).slice(0, 10), concepto: "Matrícula", importe: mat, metodo: metodoLabel(i.metodo_pagamento as string) });
  }

  const { data: ing } = await supabaseAdmin
    .from("ingresos_stripe").select("id, fecha, importe, concepto, metodo").ilike("email", e);
  for (const g of ing ?? []) {
    pagos.push({ id: `stripe_${g.id}`, fecha: (g.fecha as string).slice(0, 10), concepto: (g.concepto as string) || "Pago", importe: Number(g.importe) || 0, metodo: metodoLabel(g.metodo as string) });
  }

  pagos.sort((a, b) => b.fecha.localeCompare(a.fecha));
  return NextResponse.json({ data: pagos });
}
