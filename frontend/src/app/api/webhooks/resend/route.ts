import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";

// Recibe los eventos de Resend (entregado / abierto / clic / rebote) y marca la
// fila de email_envios correspondiente (por el id de Resend). Con eso el admin
// calcula el open rate y el click rate. Lo llama Resend, no un usuario: se
// protege verificando la firma Svix con el secreto del webhook.

function firmaValida(secret: string, req: NextRequest, body: string): boolean {
  const id = req.headers.get("svix-id");
  const ts = req.headers.get("svix-timestamp");
  const sig = req.headers.get("svix-signature");
  if (!id || !ts || !sig) return false;
  const clave = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const esperado = crypto.createHmac("sha256", clave).update(`${id}.${ts}.${body}`).digest("base64");
  // El header es "v1,<firma> v1,<firma2> …" — vale si alguna coincide.
  return sig.split(" ").map(s => s.split(",")[1]).filter(Boolean).some(s => {
    const a = Buffer.from(s), b = Buffer.from(esperado);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

const CAMPO: Record<string, string> = {
  "email.opened": "abierto_at",
  "email.clicked": "clic_at",
  "email.bounced": "rebotado_at",
  "email.complained": "rebotado_at",
};

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const body = await req.text();
  if (!secret) return NextResponse.json({ error: "Webhook sin configurar." }, { status: 500 });
  if (!firmaValida(secret, req, body)) return NextResponse.json({ error: "Firma no válida." }, { status: 401 });

  let evento: { type?: string; data?: { email_id?: string } };
  try { evento = JSON.parse(body); } catch { return NextResponse.json({ ok: true }); }

  const campo = CAMPO[evento.type ?? ""];
  const emailId = evento.data?.email_id;
  if (campo && emailId) {
    // Solo la primera vez (mantiene la primera apertura / primer clic).
    await supabaseAdmin.from("email_envios")
      .update({ [campo]: new Date().toISOString() })
      .eq("resend_id", emailId)
      .is(campo, null);
  }
  return NextResponse.json({ ok: true });
}
