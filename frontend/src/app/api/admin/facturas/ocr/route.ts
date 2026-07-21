import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { leerFactura } from "@/lib/factura-ocr";

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

  try {
    const datos = await leerFactura(data, mediaType);
    if (!datos || datos.noFactura) return NextResponse.json({ error: "No se pudo leer la factura" }, { status: 422 });
    return NextResponse.json({ datos });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Error al leer la factura" }, { status: 500 });
  }
}
