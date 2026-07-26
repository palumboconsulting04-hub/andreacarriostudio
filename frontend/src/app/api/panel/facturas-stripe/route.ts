import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { emailDeSesion } from "@/lib/panel-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

// Facturas OFICIALES de Stripe de la alumna: solo las facturas reales PAGADAS de
// las cuotas (suscripción). Se excluyen las de 0€ (pruebas/periodos gratis) y no
// se listan los recibos de pagos sueltos (matrícula/bono), que ya salen arriba
// como justificante. Mientras no haya cuotas cobradas (empiezan en sept), va vacío.
export type FacturaStripe = { id: string; fecha: string; importe: number; concepto: string; url: string; tipo: "factura" | "recibo" };

export async function GET() {
  const email = await emailDeSesion();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const e = email.toLowerCase().trim();

  const out: FacturaStripe[] = [];
  try {
    const customers = await stripe.customers.list({ email: e, limit: 10 });
    for (const c of customers.data) {
      const invs = await stripe.invoices.list({ customer: c.id, limit: 100 });
      for (const inv of invs.data) {
        // Solo facturas reales cobradas: pagadas, con importe > 0 y con enlace.
        if (inv.status !== "paid" || (inv.amount_paid ?? 0) <= 0 || !inv.hosted_invoice_url) continue;
        const concepto = (inv.lines?.data ?? []).map(l => l.description).filter(Boolean).join(", ") || "Cuota";
        out.push({
          id: `inv_${inv.id}`,
          fecha: new Date((inv.created ?? 0) * 1000).toISOString().slice(0, 10),
          importe: (inv.amount_paid ?? 0) / 100,
          concepto, url: inv.hosted_invoice_url, tipo: "factura",
        });
      }
    }
  } catch (err) {
    console.error("facturas-stripe:", err);
  }
  out.sort((a, b) => b.fecha.localeCompare(a.fecha));
  return NextResponse.json({ data: out });
}
