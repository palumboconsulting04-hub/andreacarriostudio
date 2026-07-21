import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function isAdmin(): Promise<boolean> {
  const s = (await cookies()).get("admin_session");
  return !!s && s.value === process.env.ADMIN_SESSION_SECRET;
}
const num = (v: unknown) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v))) ? null : Number(v);

// GET → lista de facturas (con enlace firmado al archivo). Solo admin.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data, error } = await supabaseAdmin.from("facturas")
    .select("id, fecha, proveedor, base, iva, total, categoria, deducible, archivo_path, origen, created_at")
    .order("fecha", { ascending: false, nullsFirst: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const facturas = await Promise.all((data ?? []).map(async f => {
    let url: string | null = null;
    if (f.archivo_path) {
      const { data: s } = await supabaseAdmin.storage.from("facturas").createSignedUrl(f.archivo_path as string, 3600);
      url = s?.signedUrl ?? null;
    }
    return { ...f, url };
  }));
  return NextResponse.json({ facturas });
}

// POST → guarda una factura (sube el archivo a storage si viene). Solo admin.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const b = await req.json().catch(() => null);
  if (!b) return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });

  let archivo_path: string | null = null;
  if (b.archivoBase64) {
    const buffer = Buffer.from(b.archivoBase64 as string, "base64");
    const ext = b.mediaType === "application/pdf" ? "pdf" : ((b.mediaType as string)?.split("/")[1] || "jpg");
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabaseAdmin.storage.from("facturas").upload(path, buffer, { contentType: b.mediaType || "image/jpeg", upsert: false });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    archivo_path = path;
  }

  const { data, error } = await supabaseAdmin.from("facturas").insert({
    fecha: b.fecha || null,
    proveedor: (b.proveedor || "").toString().trim() || null,
    base: num(b.base), iva: num(b.iva), total: num(b.total),
    categoria: (b.categoria || "").toString().trim() || null,
    deducible: b.deducible !== false,
    archivo_path,
    origen: b.origen === "email" ? "email" : "foto",
  }).select("id").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}

// DELETE ?id= → borra la factura y su archivo. Solo admin.
export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta el id" }, { status: 400 });
  const { data: f } = await supabaseAdmin.from("facturas").select("archivo_path").eq("id", id).single();
  if (f?.archivo_path) await supabaseAdmin.storage.from("facturas").remove([f.archivo_path as string]);
  const { error } = await supabaseAdmin.from("facturas").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
