import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type FacturaLeida = { fecha: string | null; proveedor: string | null; base: number | null; iva: number | null; total: number | null; noFactura?: boolean };

// Lee una factura/ticket (imagen o PDF en base64) con Claude visión y devuelve sus datos.
export async function leerFactura(data: string, mediaType: string): Promise<FacturaLeida | null> {
  const esPdf = mediaType === "application/pdf";
  const media = esPdf
    ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data } }
    : { type: "image" as const, source: { type: "base64" as const, media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data } };

  const prompt = `Esto debería ser una factura o ticket de un gasto. Extrae estos datos y responde SOLO con un JSON válido, sin texto alrededor:
{"fecha":"YYYY-MM-DD","proveedor":"nombre del emisor","base":number,"iva":number,"total":number}
- "base" = base imponible (importe sin IVA). "iva" = cuota de IVA. "total" = total con IVA.
- Si no desglosa el IVA pero da el total, calcula base e iva asumiendo 21% (base = total/1.21).
- Usa punto decimal. Si un dato no aparece, ponlo a null.
- Si el documento NO es una factura ni un recibo/ticket de compra, responde exactamente {"noFactura":true}.`;

  const resp = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 400,
    messages: [{ role: "user", content: [media, { type: "text", text: prompt }] }],
  });
  const txt = resp.content.map(c => (c.type === "text" ? c.text : "")).join("");
  const match = txt.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]) as FacturaLeida; } catch { return null; }
}
