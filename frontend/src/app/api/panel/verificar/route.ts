import { NextRequest, NextResponse } from "next/server";
import { leerToken, crearSesion } from "@/lib/panel-auth";

// Verifica el token del enlace mágico y abre la sesión (cookie httpOnly).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = leerToken((body?.token ?? "").toString());
  if (!email) return NextResponse.json({ error: "Enlace no válido o caducado" }, { status: 401 });
  await crearSesion(email);
  return NextResponse.json({ ok: true, email });
}
