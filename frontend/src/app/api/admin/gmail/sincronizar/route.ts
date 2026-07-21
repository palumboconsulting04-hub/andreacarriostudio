import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { accessFromRefresh, gmailFetch } from "@/lib/gmail";
import { leerFactura } from "@/lib/factura-ocr";

export const maxDuration = 60;

async function isAdmin(): Promise<boolean> {
  const s = (await cookies()).get("admin_session");
  return !!s && s.value === process.env.ADMIN_SESSION_SECRET;
}

type Part = { filename?: string; mimeType?: string; body?: { attachmentId?: string }; parts?: Part[] };
function collectParts(p: Part): Part[] {
  const out: Part[] = [];
  if (p.filename && p.body?.attachmentId) out.push(p);
  for (const c of p.parts ?? []) out.push(...collectParts(c));
  return out;
}

// POST → busca facturas con adjunto en el correo, las lee con IA y las guarda.
export async function POST() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { data: auth } = await supabaseAdmin.from("gmail_auth").select("refresh_token").eq("id", 1).maybeSingle();
  if (!auth?.refresh_token) return NextResponse.json({ error: "Gmail no conectado" }, { status: 400 });
  const token = await accessFromRefresh(auth.refresh_token as string);
  if (!token) return NextResponse.json({ error: "No se pudo autenticar con Gmail (¿reconectar?)" }, { status: 500 });

  const q = encodeURIComponent("has:attachment newer_than:120d (factura OR invoice OR recibo OR fattura OR ticket)");
  const list = await gmailFetch(token, `messages?q=${q}&maxResults=25`);
  const messages = (list.messages as { id: string }[]) ?? [];

  let nuevas = 0;
  const LIMITE = 6; // máx adjuntos nuevos por sincronización (para no exceder el tiempo)

  for (const m of messages) {
    if (nuevas >= LIMITE) break;
    const full = await gmailFetch(token, `messages/${m.id}?format=full`);
    const parts = collectParts((full.payload as Part) || {});
    for (const p of parts) {
      if (nuevas >= LIMITE) break;
      const mime = p.mimeType || "";
      const attId = p.body?.attachmentId;
      if (!attId || !(mime === "application/pdf" || mime.startsWith("image/"))) continue;

      const fuente = `${m.id}:${attId}`;
      const { count } = await supabaseAdmin.from("facturas").select("id", { count: "exact", head: true }).eq("fuente_id", fuente);
      if ((count ?? 0) > 0) continue; // ya importada

      const att = await gmailFetch(token, `messages/${m.id}/attachments/${attId}`);
      const b64url = att.data as string;
      if (!b64url) continue;
      const buffer = Buffer.from(b64url, "base64url");

      let datos = null;
      try { datos = await leerFactura(buffer.toString("base64"), mime); } catch { datos = null; }
      if (!datos || datos.noFactura) continue;

      const ext = mime === "application/pdf" ? "pdf" : (mime.split("/")[1] || "jpg");
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabaseAdmin.storage.from("facturas").upload(path, buffer, { contentType: mime, upsert: false });
      if (upErr) continue;

      await supabaseAdmin.from("facturas").insert({
        fecha: datos.fecha || null,
        proveedor: datos.proveedor || null,
        base: datos.base, iva: datos.iva, total: datos.total,
        deducible: true, archivo_path: path, origen: "email", fuente_id: fuente,
      });
      nuevas++;
    }
  }

  return NextResponse.json({ nuevas, revisados: messages.length, limiteAlcanzado: nuevas >= LIMITE });
}
