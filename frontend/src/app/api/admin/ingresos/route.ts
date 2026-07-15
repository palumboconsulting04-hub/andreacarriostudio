import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ingresosDelMes } from "@/lib/ingresos-server";

async function isAdmin(): Promise<boolean> {
  const s = (await cookies()).get("admin_session");
  return !!s && s.value === process.env.ADMIN_SESSION_SECRET;
}

// Libro de ingresos del mes (YYYY-MM) para la hoja del asesor. Solo admin.
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const mes = req.nextUrl.searchParams.get("mes") || "";
  if (!/^\d{4}-\d{2}$/.test(mes)) return NextResponse.json({ error: "Mes inválido (YYYY-MM)" }, { status: 400 });
  const { lineas, total } = await ingresosDelMes(mes);
  return NextResponse.json({ mes, lineas, total });
}
