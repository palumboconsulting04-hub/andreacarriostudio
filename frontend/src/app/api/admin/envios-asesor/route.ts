import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";

async function isAdmin(): Promise<boolean> {
  const s = (await cookies()).get("admin_session");
  return !!s && s.value === process.env.ADMIN_SESSION_SECRET;
}

// GET → últimos envíos al asesor (registro/prueba de que se mandó). Solo admin.
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data } = await supabaseAdmin
    .from("envios_asesor")
    .select("id, tipo, mes, destinatarios, n, total, enviado_at")
    .order("enviado_at", { ascending: false })
    .limit(50);
  return NextResponse.json({ data: data ?? [] });
}
