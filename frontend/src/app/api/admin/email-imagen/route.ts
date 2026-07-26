import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import crypto from "crypto";

export const runtime = "nodejs";
export const maxDuration = 30;

async function isAdmin(): Promise<boolean> {
  const s = (await cookies()).get("admin_session");
  return !!s && s.value === process.env.ADMIN_SESSION_SECRET;
}

// Sube una imagen de campaña al bucket público "email-img" y devuelve su URL.
// La imagen llega ya reescalada del navegador (data URL base64).
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const dataUrl = (body?.imagen ?? "").toString();
  const m = /^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/.exec(dataUrl);
  if (!m) return NextResponse.json({ error: "Imagen no válida." }, { status: 400 });

  const contentType = m[1];
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  const buffer = Buffer.from(m[2], "base64");
  if (buffer.length > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "La imagen pesa demasiado (máx. 5 MB)." }, { status: 400 });
  }

  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabaseAdmin.storage.from("email-img").upload(path, buffer, { contentType, upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data } = supabaseAdmin.storage.from("email-img").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
