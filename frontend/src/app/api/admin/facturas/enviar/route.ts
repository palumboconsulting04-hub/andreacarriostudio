import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const maxDuration = 60;
const resend = new Resend(process.env.RESEND_API_KEY);

async function isAdmin(): Promise<boolean> {
  const s = (await cookies()).get("admin_session");
  return !!s && s.value === process.env.ADMIN_SESSION_SECRET;
}

// POST { mes:"YYYY-MM", email } → envía al asesor las facturas del mes: un CSV
// resumen + cada factura (PDF/imagen) adjunta. Solo admin.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const mes = (body?.mes ?? "").toString();
  if (!/^\d{4}-\d{2}$/.test(mes)) return NextResponse.json({ error: "Elige un mes concreto." }, { status: 400 });
  const emails = [...new Set(String(body?.email ?? "").split(/[,;]+/).map(s => s.trim().toLowerCase()).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))];
  if (emails.length === 0) return NextResponse.json({ error: "El email del asesor no es válido." }, { status: 400 });

  const ini = `${mes}-01`;
  const [y, m] = mes.split("-").map(Number);
  const sig = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;

  const { data: facturas } = await supabaseAdmin.from("facturas")
    .select("fecha, proveedor, base, iva, total, categoria, archivo_path")
    .gte("fecha", ini).lt("fecha", sig).order("fecha");
  if (!facturas || facturas.length === 0) return NextResponse.json({ error: "No hay facturas en ese mes." }, { status: 400 });

  const nn = (v: unknown) => (Number(v) || 0);
  const num = (v: unknown) => nn(v).toFixed(2).replace(".", ",");
  const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
  const totBase = facturas.reduce((s, f) => s + nn(f.base), 0);
  const totIva = facturas.reduce((s, f) => s + nn(f.iva), 0);
  const totTotal = facturas.reduce((s, f) => s + nn(f.total), 0);

  const csv = "﻿" + [
    ["Fecha", "Proveedor", "Base", "IVA", "Total", "Categoría"].map(esc).join(";"),
    ...facturas.map(f => [(f.fecha as string) || "", (f.proveedor as string) || "", num(f.base), num(f.iva), num(f.total), (f.categoria as string) || ""].map(esc).join(";")),
    ["", "TOTAL", num(totBase), num(totIva), num(totTotal), ""].map(esc).join(";"),
  ].join("\r\n");

  // Adjuntos: el CSV + cada archivo de factura descargado del storage.
  const attachments: { filename: string; content: Buffer }[] = [{ filename: `facturas-${mes}.csv`, content: Buffer.from(csv, "utf-8") }];
  let i = 1;
  for (const f of facturas) {
    if (!f.archivo_path) continue;
    const { data: blob } = await supabaseAdmin.storage.from("facturas").download(f.archivo_path as string);
    if (!blob) continue;
    const ext = (f.archivo_path as string).split(".").pop() || "pdf";
    const prov = ((f.proveedor as string) || "factura").replace(/[^\w\s-]/g, "").trim().slice(0, 30).replace(/\s+/g, "_");
    attachments.push({ filename: `${f.fecha}_${prov || i}.${ext}`, content: Buffer.from(await blob.arrayBuffer()) });
    i++;
  }

  const nombreMes = new Date(y, m - 1, 1).toLocaleDateString("es-ES", { month: "long", year: "numeric" });
  const from = process.env.FROM_EMAIL ?? "onboarding@resend.dev";
  try {
    const { error } = await resend.emails.send({
      from, to: emails,
      subject: `Facturas de gastos ${nombreMes} — Andrea Carrió Studio`,
      html: `<div style="font-family:Arial,sans-serif;color:#333;max-width:520px;margin:0 auto;padding:24px;">
        <p>Hola,</p>
        <p>Adjunto las facturas de gastos de <strong>${nombreMes}</strong> de Andrea Carrió Studio.</p>
        <p><strong>${facturas.length}</strong> facturas · Base ${num(totBase)} € · IVA ${num(totIva)} € · Total <strong>${num(totTotal)} €</strong></p>
        <p style="color:#888;">Van el resumen en CSV y cada factura en PDF/imagen.</p>
        <p>Un saludo,<br/>Andrea Carrió Studio</p>
      </div>`,
      attachments,
    });
    if (error) throw error;
  } catch (e) {
    console.error("enviar facturas asesor:", e);
    return NextResponse.json({ error: "No se pudo enviar el email (¿demasiados adjuntos?)." }, { status: 500 });
  }
  try { await supabaseAdmin.from("envios_asesor").insert({ tipo: "facturas", mes, destinatarios: emails.join(", "), n: facturas.length, total: totTotal }); } catch {}
  return NextResponse.json({ ok: true, n: facturas.length });
}
