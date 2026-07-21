import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function isAdmin(): Promise<boolean> {
  const s = (await cookies()).get("admin_session");
  return !!s && s.value === process.env.ADMIN_SESSION_SECRET;
}

// POST { data: base64SinPrefijo, mediaType } → lee la factura y devuelve sus datos.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const data = (body?.data ?? "").toString();
  const mediaType = (body?.mediaType ?? "image/jpeg").toString();
  if (!data) return NextResponse.json({ error: "Falta la imagen" }, { status: 400 });

  const esPdf = mediaType === "application/pdf";
  const media = esPdf
    ? { type: "document" as const, source: { type: "base64" as const, media_type: "application/pdf" as const, data } }
    : { type: "image" as const, source: { type: "base64" as const, media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif", data } };

  const prompt = `Esta es una factura o ticket de un gasto. Extrae estos datos y responde SOLO con un JSON válido, sin ningún texto alrededor:
{"fecha":"YYYY-MM-DD","proveedor":"nombre del emisor","base":number,"iva":number,"total":number}
- "base" = base imponible (importe sin IVA). "iva" = cuota de IVA. "total" = total con IVA.
- Si la factura no desglosa el IVA pero da el total, calcula base e iva asumiendo 21% (base = total/1.21).
- Usa punto decimal. Si un dato no aparece, ponlo a null.`;

  try {
    const resp = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 400,
      messages: [{ role: "user", content: [media, { type: "text", text: prompt }] }],
    });
    const txt = resp.content.find(c => c.type === "text")?.type === "text" ? (resp.content[0] as { text: string }).text : "";
    const match = txt.match(/\{[\s\S]*\}/);
    const datos = match ? JSON.parse(match[0]) : null;
    if (!datos) return NextResponse.json({ error: "No se pudo leer la factura" }, { status: 422 });
    return NextResponse.json({ datos });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Error al leer la factura" }, { status: 500 });
  }
}
