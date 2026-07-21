import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { authUrl, gmailConfigurado } from "@/lib/gmail";

async function isAdmin(): Promise<boolean> {
  const s = (await cookies()).get("admin_session");
  return !!s && s.value === process.env.ADMIN_SESSION_SECRET;
}

// GET → lleva a la pantalla de permiso de Google (solo lectura del correo).
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!gmailConfigurado()) return NextResponse.json({ error: "Faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET en el servidor." }, { status: 500 });
  return NextResponse.redirect(authUrl());
}
