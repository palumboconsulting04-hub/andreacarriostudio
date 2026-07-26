import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { emailDeSesion } from "@/lib/panel-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

// Documento oficial de Stripe por cada pago de la alumna:
//  - Suscripciones (cuotas) → factura oficial con su PDF (hosted_invoice_url).
//  - Pagos sueltos (matrícula, bono, mes en curso) → recibo oficial (receipt_url).
export type FacturaStripe = { id: string; fecha: string; importe: number; concepto: string; url: string; tipo: "factura" | "recibo" };

export async function GET() {
  const email = await emailDeSesion();
  if (!email) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const e = email.toLowerCase().trim();

  const out: FacturaStripe[] = [];
  try {
    const customers = await stripe.customers.list({ email: e, limit: 10 });
    for (const c of customers.data) {
      // Facturas oficiales (suscripciones).
      const invs = await stripe.invoices.list({ customer: c.id, limit: 100 });
      for (const inv of invs.data) {
        if (inv.status !== "paid" || !inv.hosted_invoice_url) continue;
        const concepto = (inv.lines?.data ?? []).map(l => l.description).filter(Boolean).join(", ") || "Cuota";
        out.push({
          id: `inv_${inv.id}`,
          fecha: new Date((inv.created ?? 0) * 1000).toISOString().slice(0, 10),
          importe: (inv.amount_paid ?? 0) / 100,
          concepto, url: inv.hosted_invoice_url, tipo: "factura",
        });
      }
      // Recibos oficiales de pagos sueltos (los que no vienen de una factura).
      const charges = await stripe.charges.list({ customer: c.id, limit: 100 });
      for (const ch of charges.data) {
        // `invoice` existe en la API pero el tipo del SDK lo omite; si el cargo
        // viene de una factura, se salta (ya está listado como factura).
        const deFactura = !!(ch as { invoice?: unknown }).invoice;
        if (!ch.paid || ch.status !== "succeeded" || ch.refunded || deFactura || !ch.receipt_url) continue;
        out.push({
          id: `ch_${ch.id}`,
          fecha: new Date((ch.created ?? 0) * 1000).toISOString().slice(0, 10),
          importe: (ch.amount ?? 0) / 100,
          concepto: ch.description || "Pago", url: ch.receipt_url, tipo: "recibo",
        });
      }
    }
  } catch (err) {
    console.error("facturas-stripe:", err);
  }
  out.sort((a, b) => b.fecha.localeCompare(a.fecha));
  return NextResponse.json({ data: out });
}
