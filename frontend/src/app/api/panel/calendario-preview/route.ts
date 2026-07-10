import { NextRequest, NextResponse } from "next/server";
import { generarClases } from "@/lib/calendario";

// Vista previa del calendario (para el enlace del admin). Solo disponibilidad,
// sin datos personales ni reservas de nadie.
export async function GET(req: NextRequest) {
  const disciplina = req.nextUrl.searchParams.get("disciplina") ?? "";
  if (!["barre-fit", "pilates-mat"].includes(disciplina)) {
    return NextResponse.json({ clases: [] });
  }
  const clases = await generarClases([disciplina]);
  return NextResponse.json({ clases });
}
