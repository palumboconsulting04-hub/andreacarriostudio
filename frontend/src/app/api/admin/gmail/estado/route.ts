import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { gmailConfigurado } from "@/lib/gmail";

async function isAdmin(): Promise<boolean> {
  const s = (await cookies()).get("admin_session");
  return !!s && s.value === process.env.ADMIN_SESSION_SECRET;
}

// GET → ¿está conectado el Gmail? (y ¿están puestas las credenciales?)
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { data } = await supabaseAdmin.from("gmail_auth").select("email, refresh_token").eq("id", 1).maybeSingle();
  return NextResponse.json({ conectado: !!data?.refresh_token, email: data?.email ?? null, configurado: gmailConfigurado() });
}
