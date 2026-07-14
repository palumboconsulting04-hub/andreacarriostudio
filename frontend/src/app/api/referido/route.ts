import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Resuelve un código de madrina a su NOMBRE DE PILA, para personalizar el aviso
// "te ha invitado X" en la página de compra. Solo expone el nombre de pila.
export async function GET(req: NextRequest) {
  const codigo = (req.nextUrl.searchParams.get("codigo") ?? "").trim().toUpperCase().slice(0, 20);
  if (!codigo) return NextResponse.json({ nombre: null });
  const { data } = await supabaseAdmin
    .from("referidos_codigo").select("nombre").eq("codigo", codigo).maybeSingle();
  const primer = (data?.nombre ?? "").trim().split(" ")[0];
  return NextResponse.json({ nombre: primer || null });
}
